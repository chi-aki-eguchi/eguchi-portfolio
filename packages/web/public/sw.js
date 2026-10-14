const CACHE_STATIC = "static-v3";
// Keep existing image entries: their format has not changed.
const CACHE_IMAGES = "images-v2";
const OFFLINE_URL = "/offline.html";
const OFFLINE_SCRIPT = "/offline-recovery.js";
const MAX_IMAGE_ENTRIES = 300;
const STATIC_PATTERNS = [/\.css(\?|$)/, /\.js(\?|$)/, /fonts\.googleapis\.com/, /fonts\.gstatic\.com/];

// Cache Storage is optional. A quota/security/storage failure must not turn a
// healthy network response into a failed image, stylesheet or navigation.
async function matchCached(name, request) {
  try {
    return await (await caches.open(name)).match(request);
  } catch {
    return undefined;
  }
}

async function storeStatic(request, response) {
  const ct = response.headers.get("content-type") || "";
  if (!response.ok || ct.includes("text/html")) return;
  const cache = await caches.open(CACHE_STATIC);
  await cache.put(request, response);
}

async function storeImage(request, response) {
  const cache = await caches.open(CACHE_IMAGES);
  await cache.put(request, response);
  const keys = await cache.keys();
  const excess = keys.length - MAX_IMAGE_ENTRIES;
  if (excess > 0) {
    await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
  }
}

function keepAlive(event, work) {
  // Handle background network AND cache-write failures, including the cache-hit
  // branch. Previously its unused fetch promise could reject unhandled.
  event.waitUntil(work.catch(() => {}));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await cache.addAll([OFFLINE_URL, OFFLINE_SCRIPT]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key !== CACHE_STATIC && key !== CACHE_IMAGES)
      .map((key) => caches.delete(key)))
  ));
  // Do not claim the first visit mid-load: WebKit otherwise downloads the
  // HTML-preloaded HERO image again. New navigations pick up this worker.
});

async function navigate(request) {
  let received;
  // Only idempotent document GETs are retried, once. Preserve real HTTP errors
  // instead of labelling a server error as "no Internet connection".
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (request.signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      received = await fetch(request);
      if (![502, 503, 504].includes(received.status)) return received;
    } catch (error) {
      if (request.signal.aborted) throw error;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (received) return received;
  const cached = await matchCached(CACHE_STATIC, OFFLINE_URL);
  // respondWith must always receive a Response, even if storage is unavailable.
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  return new Response(cached?.body ??
    '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>一時的にページを開けません</title><h1>一時的にページを開けません</h1><p>通信またはサーバーへの接続に問題があります。</p><a href="">再試行</a></html>',
    { status: 503, headers });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/images/")) return;

  if (sameOrigin && url.pathname.startsWith("/api/images/")) {
    const result = (async () => {
      const cached = await matchCached(CACHE_IMAGES, request);
      if (cached) return { response: cached, fresh: false };
      return { response: await fetch(request), fresh: true };
    })();
    // Register the lifetime extension synchronously. Cache hits do not rewrite
    // the image or enumerate all 300 keys while the visitor is scrolling.
    keepAlive(event, result.then(({ response, fresh }) => {
      if (fresh && response.status === 200) return storeImage(request, response.clone());
    }));
    event.respondWith(result.then(({ response }) => response));
    return;
  }

  // Navigation comes first; a document path ending in .js must not be cached
  // as a static asset. API requests above remain outside the offline fallback.
  if (sameOrigin && request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname) || pattern.test(url.href))) {
    const fetched = fetch(request);
    keepAlive(event, fetched.then((res) => storeStatic(request, res.clone())));
    event.respondWith((async () => {
      const cached = await matchCached(CACHE_STATIC, request);
      return cached ?? fetched;
    })());
  }
});
