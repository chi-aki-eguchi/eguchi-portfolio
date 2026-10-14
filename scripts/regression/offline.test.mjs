// node --test scripts/regression/offline.test.mjs
// 本物の sw.js と offline-recovery.js を、通信・Cache Storage・時計を差し替えて動かす。
// ブラウザの Service Worker の寿命や実機は確かめない（それは Playwright の確認で見る）。
// 元は PR #1（fix/offline-hero-interruption-20261014）のテスト。統合版の決めごとに合わせた:
//   - 前段の 502/503/504 は、取り直しても駄目なら案内ページ（元の番号のまま）
//   - 案内ページは間を空けて数回だけサイトを確かめ、自動の開き直しは同じ住所で3回まで
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = (name) => readFileSync(new URL(`../../packages/web/public/${name}`, import.meta.url), "utf8");
const workerSource = source("sw.js");
const recoverySource = source("offline-recovery.js");
const origin = "https://portfolio.test";
const json = () => new Response('{"status":"ok"}', { headers: { "content-type": "application/json" } });
const image = (body = "img", headers = {}) =>
  new Response(body, { headers: { "content-type": "image/webp", ...headers } });
const script = (body = "network") => new Response(body, { headers: { "content-type": "text/javascript" } });

function worker(options = {}) {
  const handlers = new Map();
  const entries = new Map();
  const fetches = [], writes = [], deleted = [], waits = [], added = [];
  let skipCount = 0;
  let now = 1_000_000;
  const key = (r) => (typeof r === "string" ? new URL(r, origin).href : r.url);
  const cache = {
    async match(r) {
      if (options.matchFails) throw new Error("SecurityError");
      return entries.get(key(r))?.clone();
    },
    async put(r, res) {
      if (options.putFails) throw new Error("QuotaExceededError");
      writes.push(key(r));
      entries.delete(key(r));
      entries.set(key(r), res.clone());
    },
    async keys() {
      return [...entries.keys()].map((url) => new Request(url));
    },
    async delete(r) {
      deleted.push(key(r));
      return entries.delete(key(r));
    },
    async addAll(requests) {
      for (const request of requests) {
        assert.equal(request.cache, "reload");
        added.push(new URL(request.url).pathname);
      }
    },
  };
  const context = {
    self: {
      location: { origin },
      navigator: { onLine: options.onLine ?? true },
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: async () => {
        skipCount += 1;
      },
      clients: {
        claim() {
          throw new Error("must not claim the first visit");
        },
      },
    },
    caches: {
      async open() {
        if (options.openFails) throw new Error("SecurityError");
        return cache;
      },
      async keys() {
        return ["static-v1", "static-v2", "images-v1", "images-v2", "someone-elses-cache"];
      },
      async delete(name) {
        deleted.push(name);
        return true;
      },
    },
    fetch: async (r) => {
      fetches.push(key(r));
      const res = options.fetch ? await options.fetch(r, fetches.length, (ms) => (now += ms)) : new Response("network");
      return res;
    },
    setTimeout: (fn, ms) => {
      waits.push(ms);
      queueMicrotask(fn);
      return waits.length;
    },
    Date: { now: () => now },
    URL, Request, Response, Headers, DOMException,
  };
  vm.runInNewContext(workerSource, context, { filename: "sw.js" });
  function dispatch(path, init = {}) {
    const url = new URL(path, path.startsWith("http") ? undefined : origin);
    const request = new Request(url, init);
    if (init.navigation) Object.defineProperty(request, "mode", { value: "navigate" });
    const pending = [];
    let response;
    handlers.get("fetch")({
      request,
      waitUntil: (p) => pending.push(p),
      respondWith: (p) => {
        response = p;
      },
    });
    return { response, settle: () => Promise.all(pending) };
  }
  async function lifecycle(type) {
    const pending = [];
    handlers.get(type)({ waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  }
  return { entries, fetches, writes, deleted, waits, added, dispatch, lifecycle, skips: () => skipCount };
}

// ── 画像 ───────────────────────────────────────────────
for (const fault of ["openFails", "matchFails", "putFails"]) {
  test(`Cache Storage の失敗（${fault}）で、通信で取れた画像を失敗させない`, async () => {
    const w = worker({ [fault]: true, fetch: () => image("network") });
    const e = w.dispatch("/api/images/photo.jpg");
    assert.equal(await (await e.response).text(), "network");
    await e.settle();
    assert.equal(w.fetches.length, 1);
  });
}
test("保存済みの画像は通信も書き直しもしない", async () => {
  const w = worker();
  w.entries.set(`${origin}/api/images/photo.jpg`, image("cached"));
  const e = w.dispatch("/api/images/photo.jpg");
  assert.equal(await (await e.response).text(), "cached");
  await e.settle();
  assert.equal(w.fetches.length, 0);
  assert.equal(w.writes.length, 0);
});
for (const [label, res] of [
  ["部分応答（206）", () => new Response("partial", { status: 206, headers: { "content-type": "image/webp" } })],
  ["前段の HTML", () => new Response("<html>502</html>", { headers: { "content-type": "text/html" } })],
  ["一時的な失敗（503）", () => new Response("{}", { status: 503, headers: { "content-type": "application/json" } })],
  ["非公開（private, no-store）", () => image("secret", { "cache-control": "private, no-store" })],
]) {
  test(`${label}の画像は保存しない`, async () => {
    const w = worker({ fetch: res });
    const e = w.dispatch("/api/images/photo.jpg");
    await e.response;
    await e.settle();
    assert.equal(w.writes.length, 0);
  });
}
test("画像の保存は300件までで、古い順に捨てる", async () => {
  const w = worker({ fetch: () => image() });
  for (let i = 0; i < 300; i += 1) w.entries.set(`${origin}/api/images/${i}`, image("old"));
  const e = w.dispatch("/api/images/new");
  await e.response;
  await e.settle();
  assert.equal(w.entries.size, 300);
  assert.deepEqual(w.deleted, [`${origin}/api/images/0`]);
});
test("一部だけの取得（Range）はブラウザに任せる", () => {
  const w = worker();
  assert.equal(w.dispatch("/api/images/video.mp4", { headers: { range: "bytes=0-99" } }).response, undefined);
});

// ── JS・CSS・書体 ──────────────────────────────────────
test("ハッシュ付きの /assets/ は、持っていれば通信しない（開いている古いタブ用に残す）", async () => {
  const w = worker();
  w.entries.set(`${origin}/assets/app-OLD.js`, script("cached-js"));
  const e = w.dispatch("/assets/app-OLD.js");
  assert.equal(await (await e.response).text(), "cached-js");
  await e.settle();
  assert.equal(w.fetches.length, 0);
});
test("名前の変わらない JS は手元を返し、裏の取り直しの失敗を受け止める", async () => {
  const w = worker({
    fetch: () => {
      throw new TypeError("network offline");
    },
  });
  w.entries.set(`${origin}/offline-recovery.js`, script("cached-js"));
  const e = w.dispatch("/offline-recovery.js");
  assert.equal(await (await e.response).text(), "cached-js");
  await e.settle(); // 未処理の拒否にならない
});
for (const fault of ["openFails", "matchFails", "putFails"]) {
  test(`Cache Storage の失敗（${fault}）で、通信で取れた CSS を失敗させない`, async () => {
    const w = worker({ [fault]: true, fetch: () => new Response("css", { headers: { "content-type": "text/css" } }) });
    const e = w.dispatch("/assets/app.css");
    assert.equal(await (await e.response).text(), "css");
    await e.settle();
  });
}
test("HTML（404 の代わりの画面など）を JS として保存しない", async () => {
  const w = worker({ fetch: () => new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } }) });
  const e = w.dispatch("/assets/app.js");
  await e.response;
  await e.settle();
  assert.equal(w.writes.length, 0);
});
test("JS・CSS の保存は200件までで、案内ページとその JS は捨てない", async () => {
  const w = worker({ fetch: () => script() });
  w.entries.set(`${origin}/offline.html`, new Response("offline"));
  w.entries.set(`${origin}/offline-recovery.js`, script());
  for (let i = 0; i < 200; i += 1) w.entries.set(`${origin}/assets/${i}.js`, script());
  const e = w.dispatch("/assets/new.js");
  await e.response;
  await e.settle();
  assert.deepEqual(w.deleted, [`${origin}/assets/0.js`]);
  assert.ok(w.entries.has(`${origin}/offline.html`));
  assert.ok(w.entries.has(`${origin}/offline-recovery.js`));
});
test("よその JS（計測など）は扱わない", () => {
  const w = worker();
  assert.equal(w.dispatch("https://www.googletagmanager.com/gtag/js.js").response, undefined);
});

// ── API・書き込み ───────────────────────────────────────
test("API と書き込みは Service Worker を通さない", () => {
  const w = worker();
  assert.equal(w.dispatch("/api/settings").response, undefined);
  assert.equal(w.dispatch("/api/health").response, undefined);
  assert.equal(w.dispatch("/api/images/photo", { method: "POST" }).response, undefined);
  assert.equal(w.dispatch("/contact", { method: "POST", body: "test", navigation: true }).response, undefined);
  assert.equal(w.fetches.length, 0);
});

// ── ページの移動 ────────────────────────────────────────
for (const first of ["network", 502, 503, 504]) {
  test(`ページの移動は ${first} のとき1回だけ取り直し、取れたページを返す`, async () => {
    const w = worker({
      fetch: (_r, attempt) => {
        if (attempt === 1) {
          if (first === "network") throw new TypeError("connection reset");
          return new Response("gateway", { status: first });
        }
        return new Response("document");
      },
    });
    const e = w.dispatch("/series/one?lang=ja", { navigation: true });
    assert.equal(await (await e.response).text(), "document");
    assert.deepEqual(w.fetches, [`${origin}/series/one?lang=ja`, `${origin}/series/one?lang=ja`]);
    assert.deepEqual(w.waits, [400]);
  });
}
test("前段が35秒待って 502 を返したら、もう一度は待たせずに案内ページ（502 のまま）", async () => {
  const w = worker({
    fetch: (_r, _attempt, advance) => {
      advance(35_000);
      return new Response("Application failed to respond", { status: 502 });
    },
  });
  w.entries.set(`${origin}/offline.html`, new Response("recovery-page"));
  const res = await w.dispatch("/series/one", { navigation: true }).response;
  assert.equal(res.status, 502);
  assert.equal(await res.text(), "recovery-page");
  assert.equal(w.fetches.length, 1);
});
test("端末がオフラインと分かっているときは取り直さない", async () => {
  const w = worker({
    onLine: false,
    fetch: () => {
      throw new TypeError("offline");
    },
  });
  const res = await w.dispatch("/series/one", { navigation: true }).response;
  assert.equal(res.status, 503);
  assert.equal(w.fetches.length, 1);
});
test("保存場所が使えなくても、保存しない 503 の案内を返す", async () => {
  const w = worker({
    openFails: true,
    fetch: () => {
      throw new TypeError("offline");
    },
  });
  const res = await w.dispatch("/series/one", { navigation: true }).response;
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(await res.text(), /通信が不安定か、サイトが一時的に応答していません/);
});
test("案内ページは、保存時の転送用の見出しを持ち越さない", async () => {
  const w = worker({
    fetch: () => {
      throw new TypeError("offline");
    },
  });
  w.entries.set(`${origin}/offline.html`, new Response("offline-page", { headers: { "content-length": "987", "content-encoding": "br" } }));
  const res = await w.dispatch("/series/one", { navigation: true }).response;
  assert.equal(await res.text(), "offline-page");
  assert.equal(res.headers.get("content-length"), null);
  assert.equal(res.headers.get("content-encoding"), null);
});
for (const status of [401, 403, 404, 500]) {
  test(`サイトが返した ${status} は、そのまま見せる（回線のせいにしない）`, async () => {
    const w = worker({ fetch: () => new Response("server response", { status }) });
    const res = await w.dispatch("/series/one", { navigation: true }).response;
    assert.equal(res.status, status);
    assert.equal(await res.text(), "server response");
    assert.equal(w.fetches.length, 1);
  });
}
test("`.js` で終わる住所のページを JS として保存しない", async () => {
  const w = worker();
  const e = w.dispatch("/example.js", { navigation: true });
  await e.response;
  await e.settle();
  assert.equal(w.writes.length, 0);
});
test("取り消されたページの移動は、取り直さない", async () => {
  const controller = new AbortController();
  controller.abort();
  const w = worker();
  await assert.rejects(w.dispatch("/series/one", { navigation: true, signal: controller.signal }).response, {
    name: "AbortError",
  });
  assert.equal(w.fetches.length, 0);
});
test("1回目の失敗の後に取り消されたら、2回目を始めない", async () => {
  const controller = new AbortController();
  const w = worker({
    fetch: () => {
      controller.abort();
      throw new TypeError("reset");
    },
  });
  await assert.rejects(w.dispatch("/series/one", { navigation: true, signal: controller.signal }).response);
  assert.equal(w.fetches.length, 1);
});

// ── 入れ替え ───────────────────────────────────────────
test("入れ替え: 案内ページと JS を取り直して入れ、自分の古い入れ物だけ捨てる（claim しない）", async () => {
  const w = worker();
  await w.lifecycle("install");
  await w.lifecycle("activate");
  assert.deepEqual(w.added, ["/offline.html", "/offline-recovery.js"]);
  assert.equal(w.skips(), 1);
  // static-v2（開いているタブの JS が入っている）は残す。よその入れ物にも触らない。
  assert.deepEqual(w.deleted, ["static-v1", "images-v1"]);
});

// ── 案内ページの自動復帰 ────────────────────────────────
async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await new Promise(setImmediate);
}
function recovery(options = {}) {
  const handlers = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const storage = options.storage ?? new Map();
  const clock = options.clock ?? { now: () => Date.now() };
  let reloads = 0;
  let fetches = 0;
  let prevented = false;
  const elements = { status: { textContent: "" }, reason: { textContent: "" }, retry: {} };
  elements.retry.addEventListener = (name, fn) => handlers.set(`retry:${name}`, fn);
  const location = {
    pathname: "/series/one",
    search: "?lang=ja",
    hash: "#photo-2",
    reload: () => {
      reloads += 1;
    },
  };
  const window = {
    setTimeout: (fn, ms) => {
      nextTimer += 1;
      timers.set(nextTimer, { fn, ms });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const document = {
    visibilityState: options.hidden ? "hidden" : "visible",
    getElementById: (id) => elements[id],
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const navigator = { onLine: options.online ?? true };
  vm.runInNewContext(
    recoverySource,
    {
      window, document, navigator, location, AbortController, JSON,
      Date: clock,
      sessionStorage: {
        getItem: (key) => {
          if (options.storageFails) throw new Error("SecurityError");
          return storage.get(key) ?? null;
        },
        setItem: (key, value) => {
          if (options.storageFails) throw new Error("QuotaExceededError");
          storage.set(key, value);
        },
      },
      fetch: async (...args) => {
        fetches += 1;
        return options.fetch ? options.fetch(...args) : json();
      },
    },
    { filename: "offline-recovery.js" },
  );
  return {
    location, document, navigator, storage, timers, elements,
    reloads: () => reloads,
    fetches: () => fetches,
    /** 次の確認（いちばん早い予約）を動かす。probe の中の打ち切りの予約は動かさない。 */
    async tick() {
      const next = [...timers.entries()].filter(([, t]) => t.fn.name === "probe").sort((a, b) => a[0] - b[0])[0];
      if (!next) return false;
      timers.delete(next[0]);
      next[1].fn();
      await flush();
      return true;
    },
    pendingProbes: () => [...timers.values()].filter((t) => t.fn.name === "probe").map((t) => t.ms),
    emit: (name) => handlers.get(name)?.({ preventDefault() { prevented = true; } }),
    click: () => handlers.get("retry:click")?.({ preventDefault() { prevented = true; } }),
    prevented: () => prevented,
  };
}
test("サイトが答えたら、元の住所（query・hash ごと）を1回だけ開き直す", async () => {
  const r = recovery();
  assert.deepEqual(r.pendingProbes(), [2000]); // 開いてすぐには叩かない
  await r.tick();
  assert.equal(r.reloads(), 1);
  r.emit("online");
  r.emit("visibilitychange");
  r.click();
  await flush();
  assert.equal(r.reloads(), 1);
  assert.equal(JSON.parse(r.storage.get("portfolio:offline-auto-retry")).page, "/series/one?lang=ja#photo-2");
});
test("開き直して30秒以内にまた失敗したら、30秒たつまで自動では開き直さない（ボタンは使える）", async () => {
  let now = 100_000;
  const clock = { now: () => now };
  const first = recovery({ clock });
  await first.tick();
  assert.equal(first.reloads(), 1);
  const second = recovery({ clock, storage: first.storage });
  await second.tick();
  assert.equal(second.reloads(), 0);
  assert.equal(second.fetches(), 0); // サイトにも問い合わせない
  assert.deepEqual(second.pendingProbes(), [5000]); // 30秒たてば次の確認で開き直せる
  second.click();
  assert.equal(second.reloads(), 1);
  assert.equal(second.prevented(), true);
});
test("長い障害でも、自動の開き直しは同じ住所で3回まで", async () => {
  let now = 0;
  const clock = { now: () => now };
  const storage = new Map();
  let total = 0;
  for (let doc = 0; doc < 6; doc += 1) {
    const r = recovery({ clock, storage });
    while (r.reloads() === 0 && (await r.tick())) now += 40_000;
    total += r.reloads();
  }
  assert.equal(total, 3);
});
test("確認は間を空けて5回まで。その後は止まって案内を出す", async () => {
  const r = recovery({ fetch: () => new Response("down", { status: 502 }) });
  const waits = [];
  for (;;) {
    const pending = r.pendingProbes();
    if (pending.length === 0) break;
    waits.push(pending[0]);
    await r.tick();
  }
  assert.deepEqual(waits, [2000, 5000, 10_000, 20_000, 40_000]);
  assert.equal(r.fetches(), 5);
  assert.equal(r.reloads(), 0);
  assert.match(r.elements.status.textContent, /自動の確認を止めました/);
});
for (const kind of ["offline", "hidden", "storage-failure", "500", "html", "network-error"]) {
  test(`自動では開き直さない: ${kind}`, async () => {
    const r = recovery({
      online: kind !== "offline",
      hidden: kind === "hidden",
      storageFails: kind === "storage-failure",
      fetch: () => {
        if (kind === "network-error") throw new TypeError("offline");
        if (kind === "500") return new Response("server error", { status: 500 });
        if (kind === "html") return new Response("<html/>", { headers: { "content-type": "text/html" } });
        return json();
      },
    });
    await r.tick();
    assert.equal(r.reloads(), 0);
    r.click();
    assert.equal(r.reloads(), 1);
  });
}
test("オフラインで始まったら、つながった合図でサイトを確かめてから開き直す", async () => {
  const r = recovery({ online: false });
  await r.tick();
  assert.equal(r.fetches(), 0);
  assert.match(r.elements.reason.textContent, /インターネットにつながっていない/);
  r.navigator.onLine = true;
  r.emit("online");
  await flush();
  assert.equal(r.reloads(), 1);
});
test("サイトへの確認は5秒で打ち切る", async () => {
  const r = recovery({
    fetch: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")), { once: true });
      }),
  });
  await r.tick();
  const abortTimer = [...r.timers.entries()].find(([, t]) => t.fn.name !== "probe");
  assert.ok(abortTimer, "打ち切りの予約がある");
  r.timers.delete(abortTimer[0]);
  abortTimer[1].fn();
  await flush();
  assert.equal(abortTimer[1].ms, 5000);
  assert.equal(r.reloads(), 0);
  assert.deepEqual(r.pendingProbes(), [5000]); // 打ち切られたら次の確認を待つ
});
