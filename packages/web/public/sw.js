const CACHE_STATIC = "static-v2";
// 上限も破棄も無いまま溜め続けた images-v1 は、名前を変えることで activate 時に
// まとめて捨てる。キャッシュの作り方を変えたら、ここの版を必ず上げること。
const CACHE_IMAGES = "images-v2";
const OFFLINE_URL = "/offline.html";

// 画像キャッシュの上限（件数）。青天井にすると端末のストレージを圧迫し、
// ブラウザにオリジンごと丸ごと捨てられる。入れた順に古いものから捨てる。
const MAX_IMAGE_ENTRIES = 300;

async function putImageWithinLimit(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  const excess = keys.length - MAX_IMAGE_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

const STATIC_PATTERNS = [/\.css(\?|$)/, /\.js(\?|$)/, /fonts\.googleapis\.com/, /fonts\.gstatic\.com/];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_STATIC && k !== CACHE_IMAGES).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/images/")) return;

  if (url.pathname.startsWith("/api/images/")) {
    e.respondWith(
      caches.open(CACHE_IMAGES).then((cache) =>
        cache.match(e.request).then((cached) => {
          if (cached) return cached;
          return fetch(e.request).then((res) => {
            // 206(部分応答)を丸ごと保存すると、次回に欠けた画像を返す。
            if (res.status === 200) {
              const stored = putImageWithinLimit(cache, e.request, res.clone());
              // 保存と間引きで応答を待たせない。失敗しても表示は続ける。
              if (e.waitUntil) e.waitUntil(stored.catch(() => {}));
            }
            return res;
          });
        })
      )
    );
    return;
  }

  if (STATIC_PATTERNS.some((p) => p.test(url.pathname) || p.test(url.href))) {
    e.respondWith(
      caches.open(CACHE_STATIC).then((cache) =>
        cache.match(e.request).then((cached) => {
          const fetched = fetch(e.request).then((res) => {
            const ct = res.headers.get("content-type") || "";
            if (res.ok && !ct.includes("text/html")) cache.put(e.request, res.clone());
            return res;
          });
          return cached || fetched;
        })
      )
    );
    return;
  }

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
