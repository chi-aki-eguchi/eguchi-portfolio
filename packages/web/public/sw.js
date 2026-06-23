const CACHE_STATIC = "static-v1";
const CACHE_IMAGES = "images-v1";
const OFFLINE_URL = "/offline.html";

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
            if (res.ok) cache.put(e.request, res.clone());
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
            if (res.ok) cache.put(e.request, res.clone());
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
