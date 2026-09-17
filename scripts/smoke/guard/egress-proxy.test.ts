// ブラウザ用の遮断プロキシ（scripts/smoke/egress-proxy.ts）。宛先は .invalid だけで、外へは出ない。
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { splitEgressHits, startEgressProxy } from "../egress-proxy.ts";

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((r) => server.close(r));
  return port;
}

function send(port: number, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => socket.write(text));
    let data = "";
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });
}

test("the proxy answers 403 without forwarding, and only font preconnects are expected", async () => {
  const port = await freePort();
  const proxy = await startEgressProxy(port);
  try {
    const plain = await send(port, "GET http://tracker.invalid/pixel HTTP/1.1\r\nHost: tracker.invalid\r\n\r\n");
    const tunnel = await send(port, "CONNECT api.invalid:443 HTTP/1.1\r\nHost: api.invalid:443\r\n\r\n");
    const font = await send(port, "CONNECT fonts.gstatic.com:443 HTTP/1.1\r\nHost: fonts.gstatic.com:443\r\n\r\n");
    for (const response of [plain, tunnel, font]) assert.match(response, /^HTTP\/1\.1 403 Forbidden/);
    assert.deepEqual(
      proxy.hits.map((hit) => hit.request),
      [
        "GET http://tracker.invalid/pixel HTTP/1.1",
        "CONNECT api.invalid:443 HTTP/1.1",
        "CONNECT fonts.gstatic.com:443 HTTP/1.1",
      ],
    );
    const { preconnect, unexpected } = splitEgressHits(proxy.hits);
    assert.equal(preconnect.length, 1);
    assert.deepEqual(unexpected.map((hit) => hit.request), [
      "GET http://tracker.invalid/pixel HTTP/1.1",
      "CONNECT api.invalid:443 HTTP/1.1",
    ]);
    // フォントでも CONNECT 以外（平文の要求）は想定外として扱う。
    assert.equal(splitEgressHits([{ at: "", request: "GET http://fonts.gstatic.com/x HTTP/1.1" }]).unexpected.length, 1);
  } finally {
    await proxy.close();
  }
});

test("a busy proxy port stops the run instead of sharing it", async () => {
  const blocker = net.createServer();
  await new Promise<void>((r) => blocker.listen(0, "127.0.0.1", r));
  const { port } = blocker.address() as net.AddressInfo;
  try {
    await assert.rejects(startEgressProxy(port), /使用中なら止めてから/);
  } finally {
    await new Promise((r) => blocker.close(r));
  }
});
