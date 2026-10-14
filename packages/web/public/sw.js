const CACHE_STATIC = "static-v3";
const CACHE_IMAGES = "images-v2";
const OFFLINE_URL = "/offline.html";
const MAX_IMAGE_ENTRIES = 300;
const FONT_ORIGINS = new Set([
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
]);

// Cache Storage is optional: eviction, private browsing or a storage error must
// not turn an otherwise successful network request into a broken image/script.
async function openCache(name) {
  try {
    return await caches.open(name);
  } catch {
    return null;
  }
}

async function matchCache(cache, request) {
  try {
    return cache ? await cache.match(request) : undefined;
  } catch {
    return undefined;
  }
}

function keepAlive(event, promise) {
  // Observe both network-refresh and cache-write failures, even when the cached
  // response was returned already. Storage is never on the display critical path.
  event.waitUntil(promise.catch(() => {}));
}

async function putImageWithinLimit(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  const excess = keys.length - MAX_IMAGE_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function imageResponse(event) {
  const cache = await openCache(CACHE_IMAGES);
  const cached = await matchCache(cache, event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  // Never store partial responses or an HTML gateway/error page as a photograph.
  if (cache && response.status === 200 &&
      !/text\/html/i.test(response.headers.get("content-type") || "")) {
    keepAlive(event, putImageWithinLimit(cache, event.request, response.clone()));
  }
  return response;
}

async function staticResponse(event) {
  const cache = await openCache(CACHE_STATIC);
  const cached = await matchCache(cache, event.request);
  const fetched = fetch(event.request).then((response) => {
    const type = response.headers.get("content-type") || "";
    if (cache && response.status === 200 && !/text\/html/i.test(type)) {
      keepAlive(event, cache.put(event.request, response.clone()));
    }
    return response;
  });
  if (cached) {
    keepAlive(event, fetched);
    return cached;
  }
  return fetched;
}

async function offlineResponse() {
  const cache = await openCache(CACHE_STATIC);
  const cached = await matchCache(cache, OFFLINE_URL);
  let html;
  try {
    html = cached ? await cached.text() : undefined;
  } catch {
    // A missing/unreadable fallback must still produce a real Response.
  }
  return new Response(html || `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>接続できませんでした</title><h1>接続できませんでした</h1>
<p>通信が不安定か、サイトが一時的に応答していない可能性があります。ブラウザーでもう一度読み込んでください。</p></html>`, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function navigationResponse(request) {
  let gatewayResponse;
  // Only idempotent page GETs are retried, once. Never retry API writes, cache
  // page HTML, or mistake a 401/404/application error for being offline.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(request);
      if (![502, 503, 504].includes(response.status)) return response;
      gatewayResponse = response;
      if (response.headers.has("retry-after")) return response;
    } catch (error) {
      // A cancelled navigation must not start another request.
      if (request.signal?.aborted) throw error;
    }
    if (attempt === 0) {
      if (self.navigator?.onLine === false || request.signal?.aborted) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (request.signal?.aborted) throw request.signal.reason;
    }
  }
  // Preserve an actual server error instead of falsely saying the user is offline.
  return gatewayResponse || offlineResponse();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => /^(static|images)-v\d+$/.test(key) &&
        key !== CACHE_STATIC && key !== CACHE_IMAGES).map((key) => caches.delete(key)),
    )).catch(() => {}),
  );
  // Do not call clients.claim(): changing the controller during the first page's
  // preload used to download the HERO image twice in WebKit (2026-10-04).
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (request.method !== "GET") return;
  if (!sameOrigin && !FONT_ORIGINS.has(url.origin)) return;
  if (sameOrigin && url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/images/")) return;
  // Let the browser handle byte ranges instead of serving a cached full image.
  if (request.headers.has("range")) return;

  // Navigation must be checked before filename patterns: a page query containing
  // ".js" is still a page, never a static asset.
  if (sameOrigin && request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
  } else if (sameOrigin && url.pathname.startsWith("/api/images/")) {
    event.respondWith(imageResponse(event));
  } else if (/\.(css|js)$/.test(url.pathname) || FONT_ORIGINS.has(url.origin)) {
    event.respondWith(staticResponse(event));
  }
});
