// R3: 実行中テストの名前は、成功・失敗・時間切れのどれでも終了時に外れる。
// 遮断プロキシへ Google Fonts への先行接続と同じ1行を送る（403 で拒否され、転送されない）。
// テスト本文からは fonts.googleapis.com、テストの外（フック）からは fonts.gstatic.com を送り、
// 送った場所を SMOKE_PROBE_LOG に残す（guard/playwright-probes.test.ts が突き合わせる）。
import { appendFileSync } from "node:fs";
import net from "node:net";
import { test } from "../../fixtures.ts";
import { SMOKE_EGRESS_PROXY_PORT } from "../../smoke-env.ts";

async function preconnect(target: string, where: string): Promise<void> {
  const response = await new Promise<string>((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: SMOKE_EGRESS_PROXY_PORT }, () =>
      socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`),
    );
    let data = "";
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });
  const log = process.env.SMOKE_PROBE_LOG;
  if (!log) throw new Error("SMOKE_PROBE_LOG が無い");
  appendFileSync(log, `${JSON.stringify({ where, target, response: response.split("\r\n")[0] })}\n`);
}
const duringTest = (where: string) => preconnect("fonts.googleapis.com:443", where);
const outsideTest = (where: string) => preconnect("fonts.gstatic.com:443", where);

test.beforeAll(() => outsideTest("before all"));
test.afterAll(() => outsideTest("after all"));

test.describe("passing", () => {
  test("passes", async () => {
    await duringTest("passes");
  });
  test.afterAll(() => outsideTest("after passing"));
});

test.describe("failing", () => {
  test.beforeAll(() => outsideTest("before failing"));
  test("fails", async () => {
    await duringTest("fails");
    throw new Error("probe: intended failure");
  });
  test.afterAll(() => outsideTest("after failing"));
});

test.describe("timing out", () => {
  test.beforeAll(() => outsideTest("before timing out"));
  test("times out", async () => {
    test.setTimeout(3_000);
    await duringTest("times out");
    await new Promise(() => {});
  });
  test.afterAll(() => outsideTest("after timing out"));
});
