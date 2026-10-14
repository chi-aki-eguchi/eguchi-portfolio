// Run: node --test scripts/regression/site-resilience.test.mjs
// No server, production credentials or browser network is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = process.env.PORTFOLIO_SOURCE_ROOT || fileURLToPath(new URL("../../", import.meta.url));
const source = readFileSync(resolve(root, "packages/web/public/sw.js"), "utf8");
const origin = "https://portfolio.example";
const reply = (body = "ok", status = 200, headers = {}) => new Response(body, { status, headers });

function worker({ cached, network = () => reply(), storageError, online = true,
  cacheNames = ["static-v1", "static-v2", "images-v1", "images-v2", "static-v3", "unrelated-cache"],
  keys = [], delay = (fn) => { queueMicrotask(fn); return 1; } } = {}) {
  const handlers = new Map(), calls = [], writes = [], deleted = [];
  const cache = {
    match: async (request) => {
      if (storageError === "match") throw Error("cache read failed");
      return typeof cached === "function" ? cached(request) : cached?.clone();
    },
    put: async (request, response) => {
      if (storageError === "put") throw Error("quota exceeded");
      writes.push({ request, response });
    },
    keys: async () => keys,
    delete: async (key) => { deleted.push(key); return true; },
    add: async () => {},
  };
  const caches = {
    open: async () => {
      if (storageError === "open") throw Error("storage unavailable");
      return cache;
    },
    match: cache.match,
    keys: async () => cacheNames,
    delete: async (key) => { deleted.push(key); return true; },
  };
  const self = {
    location: { origin }, navigator: { onLine: online },
    addEventListener: (type, fn) => handlers.set(type, fn),
    skipWaiting() {},
    clients: { claim() { assert.fail("must not claim a partially loaded first visit"); } },
  };
  vm.runInNewContext(source, {
    self, caches, URL, Response, Headers, setTimeout: delay,
    fetch: async (request) => { calls.push(request); return network(request, calls.length); },
  }, { filename: "sw.js" });
  function dispatch(path, { mode = "navigate", method = "GET", headers = {}, signal } = {}) {
    const request = { url: new URL(path, origin).href, mode, method,
      headers: new Headers(headers), signal: signal || new AbortController().signal };
    const pending = [];
    let response;
    handlers.get("fetch")({ request,
      respondWith(value) { response = Promise.resolve(value); },
      waitUntil(value) { pending.push(Promise.resolve(value)); },
    });
    return { request, response, async settle() {
      // Cache writes may be appended while a refresh is resolving.
      for (let i = 0; i < pending.length; i++) await pending[i];
    }, pending };
  }
  return { dispatch, calls, writes, deleted, handlers };
}

const networkError = () => { throw new TypeError("network connection reset"); };

test("transient navigation failure retries the same page once", async () => {
  const w = worker({ network: (_, n) => n === 1 ? networkError() : reply("page") });
  const e = w.dispatch("/series/one?lang=ja");
  assert.equal(await (await e.response).text(), "page");
  assert.equal(w.calls.length, 2);
  assert.equal(w.calls[0].url, w.calls[1].url);
  assert.equal(w.writes.length, 0, "never persist normal page HTML");
});

test("missing cached offline page still returns a usable no-store 503", async () => {
  const w = worker({ network: networkError });
  const res = await w.dispatch("/").response;
  assert.ok(res instanceof Response);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(await res.text(), /接続できませんでした/);
  assert.equal(w.calls.length, 2);
});

test("cached offline page is returned with a failure status, not success", async () => {
  const w = worker({ cached: reply("offline copy"), network: networkError });
  const res = await w.dispatch("/series/one").response;
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "offline copy");
});

test("confirmed offline does not issue the second request", async () => {
  const w = worker({ online: false, network: networkError });
  assert.equal((await w.dispatch("/").response).status, 503);
  assert.equal(w.calls.length, 1);
});

for (const status of [502, 503, 504]) {
  test(`transient gateway ${status} recovers once`, async () => {
    const w = worker({ network: (_, n) => n === 1 ? reply("gateway", status) : reply("page") });
    assert.equal(await (await w.dispatch("/").response).text(), "page");
    assert.equal(w.calls.length, 2);
  });
}

test("persistent gateway error stays a gateway response", async () => {
  const w = worker({ network: () => reply("maintenance", 503) });
  const res = await w.dispatch("/").response;
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "maintenance");
  assert.equal(w.calls.length, 2);
});

test("Retry-After is respected rather than immediately retried", async () => {
  const w = worker({ network: () => reply("maintenance", 503, { "Retry-After": "60" }) });
  const res = await w.dispatch("/").response;
  assert.equal(res.status, 503);
  assert.equal(w.calls.length, 1);
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`application HTTP ${status} is not replaced or retried`, async () => {
    const w = worker({ network: () => reply("application", status) });
    const res = await w.dispatch("/").response;
    assert.equal(res.status, status);
    assert.equal(await res.text(), "application");
    assert.equal(w.calls.length, 1);
  });
}

test("aborted navigation does not retry", async () => {
  const controller = new AbortController();
  const w = worker({ network: () => { controller.abort(); return networkError(); } });
  await assert.rejects(w.dispatch("/", { signal: controller.signal }).response);
  assert.equal(w.calls.length, 1);
});

test("abort during retry delay does not restart navigation", async () => {
  const controller = new AbortController();
  const w = worker({ network: networkError, delay(fn) { controller.abort(); queueMicrotask(fn); return 1; } });
  await assert.rejects(w.dispatch("/", { signal: controller.signal }).response);
  assert.equal(w.calls.length, 1);
});

for (const storageError of ["open", "match", "put"]) {
  for (const path of ["/assets/main.js", "/api/images/one.jpg"]) {
    test(`cache-${storageError} failure does not break ${path}`, async () => {
      const w = worker({ storageError });
      const e = w.dispatch(path, { mode: "cors" });
      assert.equal(await (await e.response).text(), "ok");
      await e.settle();
    });
  }
}

test("failed background refresh is observed while cached JS is served", async () => {
  const w = worker({ cached: reply("cached script"), network: networkError });
  const e = w.dispatch("/assets/main.js", { mode: "cors" });
  assert.equal(await (await e.response).text(), "cached script");
  assert.ok(e.pending.length > 0, "refresh must extend worker lifetime and catch failure");
  await e.settle();
});

test("page URL with .js in its query never becomes a cached script", async () => {
  const w = worker({ cached: reply("wrong cached page"), network: () => reply("page") });
  const e = w.dispatch("/contact?from=main.js");
  assert.equal(await (await e.response).text(), "page");
  assert.equal(w.writes.length, 0);
});

for (const [path, options] of [
  ["/api/settings", {}], ["/api/admin/settings", { method: "POST" }],
  ["/api/images/one.jpg", { headers: { Range: "bytes=0-99" } }],
  ["https://other.example/script.js", {}], ["/contact", { method: "POST" }],
]) {
  test(`bypasses ${options.method || "GET"} ${path}${options.headers ? " Range" : ""}`, () => {
    const w = worker();
    assert.equal(w.dispatch(path, options).response, undefined);
    assert.equal(w.calls.length, 0);
  });
}

test("partial or HTML image responses are not cached", async () => {
  for (const res of [reply("partial", 206), reply("wrong", 200, { "Content-Type": "text/html" })]) {
    const w = worker({ network: () => res });
    const e = w.dispatch("/api/images/one.jpg", { mode: "cors" });
    await e.response; await e.settle();
    assert.equal(w.writes.length, 0);
  }
});

test("image cache remains bounded to 300 entries", async () => {
  const keys = Array.from({ length: 303 }, (_, i) => `image-${i}`);
  const w = worker({ keys });
  const e = w.dispatch("/api/images/one.jpg", { mode: "cors" });
  await e.response; await e.settle();
  assert.deepEqual(w.deleted, keys.slice(0, 3));
});

test("activation only removes old caches owned by this worker", async () => {
  const w = worker();
  const tasks = [];
  w.handlers.get("activate")({ waitUntil: (p) => tasks.push(p) });
  await Promise.all(tasks);
  assert.deepEqual(w.deleted.sort(), ["images-v1", "static-v1", "static-v2"]);
});
