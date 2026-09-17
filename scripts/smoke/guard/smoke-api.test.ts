// spec が API を直接読む唯一の経路（smoke-api.ts）を、Playwright の本物の
// APIRequestContext で確かめる（2026-09-17 のレビュー R1）。ブラウザは起動しない。
// 送り先は、このテストが 127.0.0.1 に立てた模擬サーバーと罠だけ。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type net from "node:net";
import playwright from "playwright";
import { readSmokeApi, smokeApi, smokeApiMethod, smokeApiUrl } from "../smoke-api.ts";

async function serve(handler: http.RequestListener) {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    handler(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  return { port, seen, close: () => new Promise((r) => server.close(r)) };
}

test("same-origin reads succeed, and nothing else leaves before the checks pass", async () => {
  const trap = await serve((_req, res) => res.end("trap"));
  const app = await serve((req, res) => {
    if (req.url === "/api/moved") {
      res.writeHead(302, { location: `http://127.0.0.1:${trap.port}/landed` });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
  });
  const base = `http://127.0.0.1:${app.port}`;
  const context = await playwright.request.newContext();
  const sent: { url: string; options: unknown }[] = [];
  const send = ((url: string, options?: object) => {
    sent.push({ url, options });
    return context.fetch(url, options);
  }) as typeof context.fetch;
  try {
    // 許可された同じオリジンの GET / HEAD は届く。
    const api = smokeApi(send, base);
    const ok = await api.get("/api/settings?x=1");
    assert.equal(ok.status(), 200);
    assert.deepEqual(await ok.json(), { ok: true });
    assert.equal((await api.head("/api/photos")).status(), 200);
    assert.deepEqual(app.seen, ["GET /api/settings?x=1", "HEAD /api/photos"]);
    assert.deepEqual(
      sent.map((s) => s.options),
      [
        { method: "GET", maxRedirects: 0 },
        { method: "HEAD", maxRedirects: 0 },
      ],
    );

    // リダイレクトは追わずに失敗する。罠には届かない。
    await assert.rejects(api.get("/api/moved"), /リダイレクトを返した/);

    // 書き込みのメソッドは、送る前に失敗する。
    const before = sent.length;
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "post"])
      await assert.rejects(readSmokeApi(send, base, "/api/admin/settings", method), /GET\/HEAD だけ/);

    // 別のオリジン（別ポートの localhost を含む）へは、形を変えても送らない。
    for (const path of [
      `http://127.0.0.1:${trap.port}/x`,
      `//127.0.0.1:${trap.port}/x`,
      `/\\127.0.0.1:${trap.port}/x`,
      "https://example.invalid/x",
      "api/settings",
      "",
    ])
      await assert.rejects(api.get(path), /開発サーバー/, path);
    assert.equal(sent.length, before, "rejected calls never reach the sender");

    assert.deepEqual(app.seen, ["GET /api/settings?x=1", "HEAD /api/photos", "GET /api/moved"]);
    assert.deepEqual(trap.seen, [], "the trap on another port receives nothing");
  } finally {
    await context.dispose();
    await Promise.all([app.close(), trap.close()]);
  }
});

test("the URL and method checks are exact", () => {
  const base = "http://localhost:4310";
  assert.equal(smokeApiUrl(base, "/api/series/%E6%B8%AF-2026").href, "http://localhost:4310/api/series/%E6%B8%AF-2026");
  assert.equal(smokeApiUrl(base, "/__smoke/isolation").origin, "http://localhost:4310");
  assert.throws(() => smokeApiUrl(base, "http://localhost:4311/api"), /開発サーバー/);
  assert.throws(() => smokeApiUrl(base, "http://127.0.0.1:4310/api"), /開発サーバー/);
  assert.equal(smokeApiMethod("get"), "GET");
  assert.equal(smokeApiMethod("HEAD"), "HEAD");
  assert.throws(() => smokeApiMethod("CONNECT"), /GET\/HEAD だけ/);
});
