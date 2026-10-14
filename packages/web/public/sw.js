// キャッシュ名は上げない（2026-10-14）。名前を変えると activate で旧キャッシュごと消え、
// デプロイ前から開いているタブが後から読む「ハッシュ付きの JS」まで失う（サーバーは前の
// 版の JS を 404 で返す）。入れ物の形を変えたときだけ版を上げること。
// （images-v1 は上限も破棄も無いまま溜め続けたので、v2 へ上げて捨てた。）
const CACHE_STATIC = "static-v2";
const CACHE_IMAGES = "images-v2";
const OFFLINE_URL = "/offline.html";
const OFFLINE_SCRIPT = "/offline-recovery.js";
const OFFLINE_FILES = new Set([OFFLINE_URL, OFFLINE_SCRIPT]);

// 画像キャッシュの上限（件数）。青天井にすると端末のストレージを圧迫し、
// ブラウザにオリジンごと丸ごと捨てられる。入れた順に古いものから捨てる。
const MAX_IMAGE_ENTRIES = 300;
// JS/CSS もデプロイのたびに新しいハッシュの物が増える。古い順に捨てる。
const MAX_STATIC_ENTRIES = 200;

const FONT_ORIGINS = new Set(["https://fonts.googleapis.com", "https://fonts.gstatic.com"]);
// 前段（Railway）が返す「つながらなかった」の番号。サイト自身はページでこれを返さない。
const GATEWAY_STATUSES = new Set([502, 503, 504]);
// 1回目がこれより速く失敗したときだけ、もう1回だけ取り直す。前段が35秒待って
// 502 を返した後に、もう一度35秒待たせない。
const QUICK_FAILURE_MS = 5000;
// その場で取り直す前の間。Retry-After がこれより長く、MAX_INLINE_RETRY_WAIT_MS を超える
// なら、真っ白なまま待たせずに案内ページへ移る。
const RETRY_DELAY_MS = 400;
const MAX_INLINE_RETRY_WAIT_MS = 2000;

// Cache Storage は無くても動く。容量・プライベートブラウズ・保存の失敗で、
// 通信で取れた画像・CSS・ページまで失敗させない。
async function matchCached(name, request) {
  try {
    return await (await caches.open(name)).match(request);
  } catch {
    return undefined;
  }
}

async function trimCache(cache, max, keep) {
  const keys = await cache.keys();
  const removable = keep ? keys.filter((key) => !keep(key)) : keys;
  const excess = removable.length - max;
  if (excess <= 0) return;
  await Promise.all(removable.slice(0, excess).map((key) => cache.delete(key)));
}

function storable(response, typePattern) {
  // 206（部分応答）や、前段の HTML のエラーページを写真・JS として残さない。
  // no-store / private（非公開の写真など）は端末にも残さない。
  if (response.status !== 200) return false;
  if (!typePattern.test(response.headers.get("content-type") || "")) return false;
  return !/no-store|private/i.test(response.headers.get("cache-control") || "");
}

async function storeImage(request, response) {
  const cache = await caches.open(CACHE_IMAGES);
  await cache.put(request, response);
  await trimCache(cache, MAX_IMAGE_ENTRIES);
}

async function storeStatic(request, response) {
  const cache = await caches.open(CACHE_STATIC);
  await cache.put(request, response);
  await trimCache(cache, MAX_STATIC_ENTRIES, (key) => OFFLINE_FILES.has(new URL(key.url).pathname));
}

function keepAlive(event, work) {
  // 裏での取り直しと保存の失敗は、ここで受け止める（未処理の Promise 拒否にしない）。
  event.waitUntil(work.catch(() => {}));
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function recoveryPage(status, notBefore = 0) {
  const cached = await matchCached(CACHE_STATIC, OFFLINE_URL);
  let html;
  try {
    html = cached ? await cached.text() : undefined;
  } catch {
    // 読めなくても、下の短い案内を返す。
  }
  // Retry-After の時刻を案内ページへ渡す（offline-recovery.js が読む）。
  if (html && notBefore > Date.now()) {
    html = html.replace("</head>", `<meta name="retry-not-before" content="${Math.round(notBefore)}"></head>`);
  }
  return new Response(
    html ||
      '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ページを開けませんでした</title><h1>ページを開けませんでした</h1><p>通信が不安定か、サイトが一時的に応答していません。</p><a href="">もう一度読み込む</a></html>',
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/**
 * Retry-After（秒数か HTTP の日時）を「この時刻より前に送らない」に直す。無い・読めないなら 0。
 */
function retryNotBefore(response, now) {
  const value = response?.headers.get("retry-after")?.trim();
  if (!value) return 0;
  if (/^\d+$/.test(value)) return now + Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : 0;
}

async function navigationResponse(request) {
  let gatewayStatus = 0;
  let notBefore = 0;
  // ページの GET だけを、1回だけ取り直す。書き込み（POST 等）と API はここへ来ない。
  // 404・500 など、サイトが返した答えはそのまま見せる（回線のせいにしない）。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (request.signal?.aborted) throw abortError();
    const started = Date.now();
    try {
      const response = await fetch(request);
      if (!GATEWAY_STATUSES.has(response.status)) return response;
      gatewayStatus = response.status;
      notBefore = retryNotBefore(response, Date.now());
    } catch (error) {
      // 利用者が取り消した移動は、取り直しも案内もしない。
      if (request.signal?.aborted) throw error;
    }
    if (attempt > 0 || self.navigator?.onLine === false || Date.now() - started > QUICK_FAILURE_MS) break;
    // Retry-After より早くは送らない。指示が長ければ、ここで画面を止めずに案内へ移る
    // （案内ページも、その時刻まではサイトに問い合わせない）。
    const wait = Math.max(RETRY_DELAY_MS, notBefore - Date.now());
    if (wait > MAX_INLINE_RETRY_WAIT_MS) break;
    await sleep(wait);
  }
  if (request.signal?.aborted) throw abortError();
  return recoveryPage(gatewayStatus || 503, notBefore);
}

// 手元にあれば手元から、無ければ通信で。どちらから来たかも返す（保存するかの判断用）。
// 保存済みの応答も、いま保存してよい物かを確かめてから返す。前の版の sw.js は 200 なら
// 何でも images-v2 に入れていたので、非公開（private / no-store）の写真や前段の HTML が
// 残っていることがある。合わない1件だけを捨てて通信で取り直す（入れ物ごとは消さない。
// 正常な写真と、開いているタブが後から読む JS は残す）。
async function cachedIfValid(name, request, typePattern) {
  const cached = await matchCached(name, request);
  if (!cached) return undefined;
  if (storable(cached, typePattern)) return cached;
  try {
    await (await caches.open(name)).delete(request);
  } catch {
    // 消せなくても、使わずに通信で取り直す。
  }
  return undefined;
}

async function cacheFirst(name, request, typePattern) {
  const cached = await cachedIfValid(name, request, typePattern);
  if (cached) return { response: cached, fresh: false };
  return { response: await fetch(request), fresh: true };
}

function respondCacheFirst(event, name, typePattern, store) {
  const { request } = event;
  const result = cacheFirst(name, request, typePattern);
  // 寿命の延長は同期で登録する。保存と間引きで表示を待たせない。
  keepAlive(
    event,
    result.then(({ response, fresh }) => {
      if (fresh && storable(response, typePattern)) return store(request, response.clone());
    }),
  );
  event.respondWith(result.then(({ response }) => response));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // 前の版の案内ページが HTTP キャッシュ（1時間）から入らないよう、取り直して入れる。
      const cache = await caches.open(CACHE_STATIC);
      await cache.addAll(
        [...OFFLINE_FILES].map((path) => new Request(new URL(path, self.location.origin), { cache: "reload" })),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => /^(static|images)-v\d+$/.test(key) && key !== CACHE_STATIC && key !== CACHE_IMAGES)
            .map((key) => caches.delete(key)),
        ),
      )
      .catch(() => {}),
  );
  // clients.claim() は呼ばない（2026-10-04）。呼ぶと、初めて来た人のページを
  // 読み込みの途中で引き取り、HTML が先読みした写真（トップの表紙 383KB、
  // About の写真 83KB）を img が使えず、ここでもう一度取り寄せていた
  // （通信の控えを持たない WebKit で実測: 同じ URL が2回、止めると1回）。
  // 初回はブラウザに任せ、次に開いたページから受け持つ。更新は skipWaiting で
  // 今までどおりすぐ切り替わる（既に受け持っているページは新しい版へ移る）。
});

const STATIC_TYPES = /css|javascript|font|octet-stream/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_ORIGINS.has(url.origin)) return;
  if (sameOrigin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/images/")) return;
  // 一部だけの取得（動画など）はブラウザに任せる。保存済みの全体を返さない。
  if (request.headers.has("range")) return;

  // ページの移動を先に見る。`?x=a.js` のような住所のページを JS として保存しない。
  if (sameOrigin && request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (sameOrigin && url.pathname.startsWith("/api/images/")) {
    respondCacheFirst(event, CACHE_IMAGES, /^image\//i, storeImage);
    return;
  }

  const fonts = FONT_ORIGINS.has(url.origin);
  if (!fonts && !/\.(css|js)$/.test(url.pathname)) return;

  // ハッシュ付きの /assets/ は中身が変わらない。持っていれば通信しない。
  if (sameOrigin && url.pathname.startsWith("/assets/")) {
    respondCacheFirst(event, CACHE_STATIC, STATIC_TYPES, storeStatic);
    return;
  }

  // それ以外（書体・名前の変わらない JS/CSS）は、手元の物をすぐ返し、裏で取り直す。
  const fetched = fetch(request);
  keepAlive(
    event,
    fetched.then((response) => {
      if (storable(response, STATIC_TYPES)) return storeStatic(request, response.clone());
    }),
  );
  event.respondWith(
    (async () => {
      const cached = await cachedIfValid(CACHE_STATIC, request, STATIC_TYPES);
      return cached ?? fetched;
    })(),
  );
});
