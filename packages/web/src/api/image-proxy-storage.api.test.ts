import { afterAll, beforeAll, expect, test } from "bun:test";
import sharp from "sharp";
import { startIsolatedApi, type IsolatedApi } from "./test-support/isolated-api";

// 写真の取り寄せが遅い・失敗するときの、画像の経路（/api/images/*）の約束。
// 本物の API と一時 SQLite、127.0.0.1 の偽ストレージ（isolated-api.ts）で確かめる。
//
// 2026-10-14、配布先で「timed out after 30000ms」と記録が増え、本番では画像の要求が
// 約35秒で 502 になっていた。手元で再現すると、(1) 打ち切った後も裏でストレージから
// 受け取り続け、その写真の取り寄せが「処理中」のまま残り、(2) 一時的な失敗まで
// 「写真は無い」（404）と答えていた。

let api: IsolatedApi;
let photo: Buffer;
/** 遅い本文の流れが、受け手に切られた（cancel された）回数。 */
let cancelledBodies = 0;

beforeAll(async () => {
  photo = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 80, b: 70 } },
  })
    .webp()
    .toBuffer();
  api = await startIsolatedApi({
    storageGet(key) {
      if (key.includes("broken"))
        return new Response("<Error><Code>InternalError</Code></Error>", {
          status: 500,
          headers: { "content-type": "application/xml" },
        });
      if (key.includes("trickle")) {
        // 見出しはすぐ、本文は少しずつ（いつまでも終わらない遅いストレージ）。
        let timer: ReturnType<typeof setInterval> | undefined;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            timer = setInterval(() => controller.enqueue(new Uint8Array(16 * 1024)), 100);
          },
          cancel() {
            clearInterval(timer);
            cancelledBodies += 1;
          },
        });
        return new Response(body, {
          headers: { "content-type": "image/webp", "content-length": String(64 * 1024 * 1024) },
        });
      }
      if (key.includes("ok"))
        return new Response(photo, { headers: { "content-type": "image/webp" } });
      return undefined; // NoSuchKey
    },
  });
}, 30_000);

afterAll(async () => {
  await api?.stop();
});

const mem = async () =>
  ((await (await api.request("/api/health")).json()) as { mem: Record<string, number> }).mem;

test("本当に無い写真だけが 404。ストレージの一時的な失敗は 503 で、保存させない", async () => {
  const missing = await api.request("/api/images/thumbs/missing.webp");
  expect(missing.status).toBe(404);

  const broken = await api.request("/api/images/thumbs/broken.webp");
  expect(broken.status).toBe(503);
  expect(broken.headers.get("cache-control")).toBe("no-store");
  expect(broken.headers.get("retry-after")).toBe("5");

  const ok = await api.request("/api/images/thumbs/ok.webp?w=400");
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toContain("immutable");
});

test("取り寄せが遅いと15秒で打ち切り、本文の受信も止めて、処理中に残さない", async () => {
  const started = Date.now();
  const res = await api.request("/api/images/thumbs/trickle.webp");
  const elapsed = Date.now() - started;
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
  // 30秒の全体の打ち切りより前に、取り寄せの打ち切り（15秒）で答える。取り直さない。
  expect(elapsed).toBeGreaterThanOrEqual(14_000);
  expect(elapsed).toBeLessThan(20_000);

  await Bun.sleep(500);
  // 修正前は、打ち切った後もストレージから受け取り続け、取り寄せが処理中のまま残った。
  expect(cancelledBodies).toBe(1);
  const after = await mem();
  expect(after.origInFlightEntries).toBe(0);
  expect(after.resizeInFlightEntries).toBe(0);
  expect(after.activeImageTransforms).toBe(0);
  expect(after.queuedImageTransforms).toBe(0);

  // 打ち切りの後でも、届く写真はいつもどおり届く。
  const ok = await api.request("/api/images/thumbs/ok-after.webp?w=300");
  expect(ok.status).toBe(200);
}, 40_000);
