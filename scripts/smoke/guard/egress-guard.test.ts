// smoke の開発サーバー（Node）で外への TCP 接続が止まること。
// 宛先は TEST-NET（192.0.2.0/24、実在しない文書用アドレス）で、止まらなくても外へは届かない。
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import {
  blockedConnections,
  installSmokeEgressGuard,
} from "../../../packages/web/vite/smoke-egress-guard.ts";

installSmokeEgressGuard();

function connectError(socket: net.Socket): Promise<NodeJS.ErrnoException> {
  return new Promise((resolve, reject) => {
    socket.once("error", resolve);
    socket.once("connect", () => reject(new Error("connected")));
  });
}

test("plain TCP to a non-loopback host is refused before connecting", async () => {
  const error = await connectError(net.connect({ host: "192.0.2.10", port: 5432 }));
  assert.equal(error.code, "ESMOKEBLOCKED");
  assert.deepEqual(blockedConnections().at(-1), { host: "192.0.2.10", port: "5432" });
});

test("TLS and the (port, host) form are refused too", async () => {
  const error = await connectError(tls.connect({ host: "192.0.2.11", port: 443, servername: "dummy.invalid" }));
  assert.equal(error.code, "ESMOKEBLOCKED");
  const second = await connectError(net.connect(6543, "192.0.2.12"));
  assert.equal(second.code, "ESMOKEBLOCKED");
});

test("fetch to an outside host fails quickly", async () => {
  const started = Date.now();
  await assert.rejects(fetch("https://192.0.2.13/probe"));
  assert.ok(Date.now() - started < 2000);
  assert.ok(blockedConnections().some((c) => c.host === "192.0.2.13"));
});

test("loopback connections still work", async () => {
  const server = net.createServer((socket) => socket.end("ok"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  const text = await new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    let data = "";
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });
  assert.equal(text, "ok");
  await new Promise((resolve) => server.close(resolve));
});
