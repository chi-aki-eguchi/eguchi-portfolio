/**
 * `public/sw.js` の回帰テスト。
 *
 * 配信に関わるのにテストが無かった。特に画像キャッシュは、上限と破棄が無いと
 * 端末のストレージを埋め、ブラウザにオリジンごと捨てられる。
 * ここでは本物の sw.js をそのまま読み込み、偽の caches / fetch で動かす。
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const SW_SOURCE = readFileSync(
  import.meta.dir + "/../../../public/sw.js",
  "utf8",
);

type Handlers = Record<string, (event: unknown) => void>;

class FakeCache {
  entries = new Map<string, { status: number }>();
  async put(request: { url: string }, response: { status: number }) {
    this.entries.delete(request.url); // put は上書き = 入れ直し
    this.entries.set(request.url, response);
  }
  async match(request: { url: string }) {
    return this.entries.get(request.url);
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  async delete(request: { url: string }) {
    return this.entries.delete(request.url);
  }
  async add() {}
}

function loadWorker(fetchImpl: (req: { url: string }) => Promise<unknown>) {
  const handlers: Handlers = {};
  const cacheStore = new Map<string, FakeCache>();
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const caches = {
    open: async (name: string) => {
      const existing = cacheStore.get(name);
      if (existing) return existing;
      const created = new FakeCache();
      cacheStore.set(name, created);
      return created;
    },
    keys: async () => [...cacheStore.keys()],
    delete: async (name: string) => cacheStore.delete(name),
    match: async () => undefined,
  };
  // sw.js は self / caches / fetch をグローバルとして参照するので、
  // import ではなく偽のグローバルを渡して評価する。読み込むのは
  // このリポジトリの `public/sw.js` だけで、外部入力は混ぜない。
  new Function(
    "self",
    "caches",
    "fetch",
    "URL",
    SW_SOURCE,
  )(self, caches, fetchImpl, URL);
  return { handlers, cacheStore, caches };
}

/** 画像リクエストを1件流し、応答が返るまで待つ。 */
async function requestImage(
  handlers: Handlers,
  url: string,
  status = 200,
): Promise<unknown> {
  let responded: Promise<unknown> | undefined;
  const pending: Promise<unknown>[] = [];
  handlers.fetch?.({
    request: { url, method: "GET", mode: "no-cors" },
    respondWith: (p: Promise<unknown>) => {
      responded = p;
    },
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    },
  });
  const result = await responded;
  await Promise.all(pending);
  void status;
  return result;
}

function imageFetch(status = 200) {
  return async (req: { url: string }) => ({
    url: req.url,
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => "image/webp" },
    clone() {
      return { url: req.url, status };
    },
  });
}

const IMG = (n: number) => `https://x.test/api/images/photo-${n}.webp?w=800`;

describe("service worker image cache", () => {
  test("caches an image and serves the second request from the cache", async () => {
    let networkCalls = 0;
    const { handlers, cacheStore } = loadWorker(async (req) => {
      networkCalls += 1;
      return imageFetch()(req);
    });

    await requestImage(handlers, IMG(1));
    await requestImage(handlers, IMG(1));

    expect(networkCalls).toBe(1);
    expect(cacheStore.get("images-v2")?.entries.size).toBe(1);
  });

  test("keeps the image cache bounded and drops the oldest first", async () => {
    const { handlers, cacheStore } = loadWorker(imageFetch());

    for (let i = 1; i <= 320; i += 1) await requestImage(handlers, IMG(i));

    const cache = cacheStore.get("images-v2");
    expect(cache?.entries.size).toBe(300);
    // 最初に入れた20件が消えている。
    expect(cache?.entries.has(IMG(1))).toBe(false);
    expect(cache?.entries.has(IMG(20))).toBe(false);
    expect(cache?.entries.has(IMG(21))).toBe(true);
    expect(cache?.entries.has(IMG(320))).toBe(true);
  });

  test("does not store a partial (206) response", async () => {
    const { handlers, cacheStore } = loadWorker(imageFetch(206));

    await requestImage(handlers, IMG(1));

    expect(cacheStore.get("images-v2")?.entries.size ?? 0).toBe(0);
  });

  test("does not store a failed response", async () => {
    const { handlers, cacheStore } = loadWorker(imageFetch(503));

    await requestImage(handlers, IMG(1));

    expect(cacheStore.get("images-v2")?.entries.size ?? 0).toBe(0);
  });

  test("the retry parameter is a different entry, so a retry reaches the network", async () => {
    let networkCalls = 0;
    const { handlers } = loadWorker(async (req) => {
      networkCalls += 1;
      return imageFetch()(req);
    });

    await requestImage(handlers, IMG(1));
    await requestImage(handlers, `${IMG(1)}&retry=1`);

    expect(networkCalls).toBe(2);
  });
});

describe("service worker cache versions", () => {
  test("activate drops every cache that is not current", async () => {
    const { handlers, caches, cacheStore } = loadWorker(imageFetch());
    await caches.open("images-v1");
    await caches.open("static-v1");
    await caches.open("images-v2");

    const waits: Promise<unknown>[] = [];
    handlers.activate?.({
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await Promise.all(waits);

    expect([...cacheStore.keys()].sort()).toEqual(["images-v2"]);
  });

  test("the image cache name is versioned so a format change can purge it", () => {
    expect(SW_SOURCE).toMatch(/CACHE_IMAGES = "images-v\d+"/);
  });
});
