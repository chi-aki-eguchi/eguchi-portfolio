// 本物の fixtures.ts・global-setup.ts・隔離サーバーで Playwright を動かし、
// 2026-09-17 のレビュー R1〜R3 の受け入れ条件を確かめる（probes/*.probe.ts）。
// どれも desktop の部分実行で、smoke-isolation.spec.ts は含まない。
// 送り先は 127.0.0.1 の隔離サーバー・罠・遮断プロキシだけ。本番の宛先・資格情報は使わない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isExpectedPreconnect, type EgressHit } from "../egress-proxy.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((r) => server.close(r));
  return port;
}

type ProbeRun = {
  code: number | null;
  output: string;
  json: <T>(name: string) => T | null;
  lines: (name: string) => Record<string, string>[];
};

/** probe を1つ動かし、証拠フォルダの中身を読んでから片付ける。 */
async function runProbe(file: string, check: (run: ProbeRun) => void | Promise<void>) {
  const [webPort, storagePort, proxyPort] = [await freePort(), await freePort(), await freePort()];
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "portfolio-guard-evidence-"));
  const evidence = join(scratch, "evidence");
  // この実行の一時フォルダを決めて渡す（隔離サーバーが作り、終了時に消す）。
  const runDir = join(realpathSync(tmpdir()), `portfolio-smoke-probe-${randomBytes(4).toString("hex")}`);
  const pw = spawn(
    join(repoRoot, "node_modules/.bin/playwright"),
    ["test", "--config", "scripts/smoke/guard/probes/probe.config.ts", file],
    {
      cwd: repoRoot,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? tmpdir(),
        SMOKE_WEB_PORT: String(webPort),
        SMOKE_STORAGE_PORT: String(storagePort),
        SMOKE_EGRESS_PROXY_PORT: String(proxyPort),
        SMOKE_RUN_DIR: runDir,
        SMOKE_EVIDENCE_DIR: evidence,
        SMOKE_PROBE_LOG: join(scratch, "probe-log.jsonl"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  pw.stdout!.on("data", (c) => (output += c));
  pw.stderr!.on("data", (c) => (output += c));
  const code = await new Promise<number | null>((r) => pw.once("exit", r));
  const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : null);
  try {
    await check({
      code,
      output,
      json: (name) => {
        const text = read(join(evidence, name));
        return text === null ? null : JSON.parse(text);
      },
      lines: (name) =>
        (read(join(scratch, name)) ?? "")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  // 隔離サーバーは自分の一時フォルダを消し、ポートを閉じている。
  assert.ok(output.includes(runDir), "the run used the folder given here");
  assert.equal(existsSync(runDir), false, "the run folder is removed");
  for (const port of [webPort, storagePort, proxyPort]) {
    const open = await new Promise<boolean>((r) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => (socket.destroy(), r(true)));
      socket.once("error", () => r(false));
    });
    assert.equal(open, false, `port ${port} is closed`);
  }
}

type Summary = { runErrors: string[]; failures: { title: string; status: string; errors: string[] }[] };
type EgressReport = {
  ok: boolean;
  problems: string[];
  unexpected: number;
  expectedPreconnect: number;
  server: { status?: number; blockedConnections?: { host: string }[] };
  hits: EgressHit[];
};

test("R1: in the real fixtures, only `api` reaches the API and direct clients stop before sending", async () => {
  await runProbe("api-boundary.probe.ts", ({ code, output, json }) => {
    assert.notEqual(code, 0, output);
    assert.match(output, /1 passed/, output);
    const summary = json<Summary>("summary.json");
    assert.ok(summary, output);
    // 失敗は request fixture を求めたテストだけで、理由は番人の拒否。
    assert.deepEqual(
      summary.failures.map((f) => f.title.split(" › ").at(-1)),
      ["the built-in request fixture is refused"],
    );
    assert.match(summary.failures[0]!.errors.join("\n"), /request fixture は直接使わない/);
    // 外への試行はブラウザ側・サーバー側とも0件（終了時の判定は通る）。
    assert.deepEqual(summary.runErrors, []);
    assert.equal(json("blocked-egress.json"), null);
  });
});

test("R2: a partial run fails when only the server tried to connect out", async () => {
  await runProbe("server-egress.probe.ts", ({ code, output, json }) => {
    assert.notEqual(code, 0, output);
    assert.match(output, /1 passed/, output);
    const summary = json<Summary>("summary.json");
    assert.ok(summary, `the evidence is kept even though every test passed\n${output}`);
    assert.deepEqual(summary.failures, []);
    assert.match(summary.runErrors.join("\n"), /サーバー側で外部への接続を止めた: note\.com:443/);
    const report = json<EgressReport>("blocked-egress.json");
    assert.ok(report, output);
    assert.equal(report.ok, false);
    assert.deepEqual(report.hits, [], "the browser side sent nothing");
    assert.equal(report.server.status, 200);
    assert.deepEqual(report.server.blockedConnections?.map((c) => c.host), ["note.com"]);
  });
});

test("R3: the running-test name is cleared after passing, failing and timing out", async () => {
  await runProbe("label-lifecycle.probe.ts", ({ code, output, json, lines }) => {
    assert.notEqual(code, 0, output);
    const summary = json<Summary>("summary.json");
    assert.ok(summary, output);
    assert.deepEqual(
      summary.failures.map((f) => [f.title.split(" › ").at(-1), f.status]),
      [
        ["fails", "failed"],
        ["times out", "timedOut"],
      ],
    );
    assert.match(output, /1 passed/, output);

    const sent = lines("probe-log.jsonl");
    const where = new Set(sent.map((entry) => entry.where));
    for (const name of [
      "before all",
      "passes",
      "after passing",
      "before failing",
      "fails",
      "after failing",
      "before timing out",
      "times out",
      "after timing out",
      "after all",
    ])
      assert.ok(where.has(name), `${name} was sent: ${[...where].join(", ")}`);
    for (const entry of sent) assert.equal(entry.response, "HTTP/1.1 403 Forbidden", entry.where);

    // プロキシが受けた順と送った順は同じ（1件ずつ応答を待って送っている）。
    const report = json<EgressReport>("blocked-egress.json");
    assert.ok(report, output);
    assert.equal(report.hits.length, sent.length);
    report.hits.forEach((hit, index) => {
      const entry = sent[index]!;
      assert.equal(hit.target, entry.target, entry.where);
      if (entry.target === "fonts.googleapis.com:443") {
        // テスト本文から: そのテストの名前が付き、想定内の先行接続として数える。
        assert.match(hit.label, new RegExp(`^desktop › guard/probes/label-lifecycle\\.probe\\.ts › ${entry.where}$`));
        assert.equal(isExpectedPreconnect(hit), true, entry.where);
      } else {
        // テストの外から: 名前は空で、宛先が同じでも想定外。
        assert.equal(hit.label, "", entry.where);
        assert.equal(isExpectedPreconnect(hit), false, entry.where);
      }
    });
    const outside = sent.filter((entry) => entry.target === "fonts.gstatic.com:443").length;
    assert.equal(report.unexpected, outside);
    assert.equal(report.expectedPreconnect, sent.length - outside);
    assert.equal(report.ok, false);
    assert.match(summary.runErrors.join("\n"), /テスト外/);
  });
});
