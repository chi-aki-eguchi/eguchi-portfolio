// R1: API を直接読む経路は fixtures.ts の `api` だけ。page.request・context.request・
// request fixture は、送る前に止まる。送り先の罠は、このテストが 127.0.0.1 に立てたものだけ。
import http from "node:http";
import type net from "node:net";
import { expect, test } from "../../fixtures.ts";

test("api reads the dev server, and direct request clients stop before sending", async ({ page, context, api }) => {
  const seen: string[] = [];
  const trap = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.end("trap");
  });
  await new Promise<void>((r) => trap.listen(0, "127.0.0.1", r));
  const { port } = trap.address() as net.AddressInfo;
  try {
    const settings = await api.get("/api/settings");
    expect(settings.status()).toBe(200);
    expect((await settings.json()).siteName).toBe("Smoke Fixture Studio");
    await expect(api.get(`http://127.0.0.1:${port}/api-other-port`)).rejects.toThrow(/開発サーバー/);

    const blocked = /直接使わない/;
    await expect(page.request.get(`http://127.0.0.1:${port}/page-get`)).rejects.toThrow(blocked);
    await expect(page.request.post(`http://127.0.0.1:${port}/page-post`, { data: {} })).rejects.toThrow(blocked);
    await expect(context.request.fetch(`http://127.0.0.1:${port}/context-fetch`)).rejects.toThrow(blocked);
    await expect(page.request.post(`http://127.0.0.1:${port}/api/admin/settings`, { data: {} })).rejects.toThrow(blocked);
    await expect(page.request.post("/api/admin/settings", { data: {} })).rejects.toThrow(blocked);
    await expect(page.request.delete("/api/admin/photos/7001")).rejects.toThrow(blocked);
    expect(seen).toEqual([]);
  } finally {
    await new Promise((r) => trap.close(r));
  }
});

test("the built-in request fixture is refused", async ({ request }) => {
  // ここには来ない（fixture の準備で失敗する）。塞がれていなければ隔離サーバーへの読み取りが
  // 通ってこのテストが成功し、playwright-probes.test.ts がそれを失敗として検出する。
  await request.get("/api/settings");
});
