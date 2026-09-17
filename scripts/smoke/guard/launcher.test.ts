// smoke の起動経路を実際に動かして確かめる。
// - 危険な接続設定は、通信を始める前に止まる（罠のサーバーに接続が1件も来ない）。
// - 親の環境変数に危険な値があっても、開発サーバーには届かない。
// - 既に同じポートで動いているサーバーは再利用も終了もしない。
// - 終了時は、その実行が作った一時フォルダとプロセスだけを片付ける。
// 本番のURL・資格情報は使わない。接続先は 127.0.0.1 の罠か .invalid。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";

const repoRoot = resolve(import.meta.dirname, "../../..");
const webDir = join(repoRoot, "packages/web");

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((r) => server.close(r));
  return port;
}

/** 接続を数えるだけの罠。応答はしない。 */
async function trap() {
  let connections = 0;
  const server = net.createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    count: () => connections,
    close: () => new Promise((r) => server.close(r)),
  };
}

function newRunDir() {
  return join(realpathSync(tmpdir()), `portfolio-smoke-guardtest-${randomBytes(4).toString("hex")}`);
}

/** このテストが起動する Playwright の証拠フォルダ。scratch/ に残さず、終わったら消す。 */
function evidenceDir(): { path: string; remove: () => void } {
  const path = mkdtempSync(join(realpathSync(tmpdir()), "portfolio-guard-evidence-"));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

function baseEnv(extra: Record<string, string>): Record<string, string> {
  return { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TMPDIR: process.env.TMPDIR ?? tmpdir(), ...extra };
}

type Run = { child: ChildProcess; output: () => string; exited: Promise<number | null> };

function launch(env: Record<string, string>): Run {
  const child = spawn("bun", ["--no-env-file", "scripts/smoke/isolated-server.ts"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  child.stdout!.on("data", (c) => (output += c));
  child.stderr!.on("data", (c) => (output += c));
  const exited = new Promise<number | null>((r) => child.once("exit", (code) => r(code)));
  return { child, output: () => output, exited };
}

async function stopGroup(run: Run) {
  if (run.child.exitCode !== null || run.child.signalCode !== null) return;
  try {
    process.kill(-run.child.pid!, "SIGTERM");
  } catch {
    /* already gone */
  }
  await Promise.race([run.exited, new Promise((r) => setTimeout(r, 10_000))]);
}

async function waitForReady(url: string, run: Run, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (run.child.exitCode !== null) throw new Error(`launcher exited early:\n${run.output()}`);
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`not ready:\n${run.output()}`);
}

async function listening(port: number): Promise<boolean> {
  return new Promise((r) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => (socket.destroy(), r(true)));
    socket.once("error", () => r(false));
  });
}

test("the launcher refuses missing or unsafe inputs before creating anything", async () => {
  const runDir = newRunDir();
  const cases: Record<string, string>[] = [
    {},
    { SMOKE_RUN_DIR: runDir, SMOKE_ADMIN_PASSWORD: "not-a-test-password-123456", SMOKE_WEB_PORT: "4390", SMOKE_STORAGE_PORT: "4391" },
    { SMOKE_RUN_DIR: "/Users/someone/portfolio-smoke-x", SMOKE_ADMIN_PASSWORD: "smoke-only-0123456789abcdef01", SMOKE_WEB_PORT: "4390", SMOKE_STORAGE_PORT: "4391" },
  ];
  for (const inputs of cases) {
    const run = launch(baseEnv(inputs));
    assert.equal(await run.exited, 2, run.output());
  }
  assert.equal(existsSync(runDir), false);
});

test("dangerous parent variables never reach the server, and it cleans up after itself", async () => {
  const db = await trap();
  const pg = await trap();
  const storageTrap = await trap();
  const [webPort, storagePort] = [await freePort(), await freePort()];
  const runDir = newRunDir();
  const run = launch(
    baseEnv({
      SMOKE_RUN_DIR: runDir,
      SMOKE_ADMIN_PASSWORD: `smoke-only-${randomBytes(12).toString("hex")}`,
      SMOKE_WEB_PORT: String(webPort),
      SMOKE_STORAGE_PORT: String(storagePort),
      // 親に残っていても使われてはいけない値（すべて罠かダミー）。
      DATABASE_URL: `libsql://127.0.0.1:${db.port}`,
      DATABASE_AUTH_TOKEN: "dummy-token",
      DATABASE_PROVIDER: "postgres",
      DATABASE_PUBLIC_URL: `postgresql://dummy:dummy@127.0.0.1:${pg.port}/app`,
      S3_ENDPOINT: `http://127.0.0.1:${storageTrap.port}`,
      S3_BUCKET: "portfolio-production",
      ADMIN_PASSWORD: "parent-password-must-not-be-used",
    }),
  );
  try {
    const base = `http://localhost:${webPort}`;
    const report = await waitForReady(`${base}/__smoke/isolation`, run);
    assert.equal(report.ok, true);
    assert.equal(report.database, join(runDir, "smoke.db"));
    assert.equal(report.storage, `http://127.0.0.1:${storagePort}`);

    for (const path of ["/api/settings", "/api/photos", "/api/series", "/api/images/photos/smoke-7001.jpg?w=64"])
      assert.equal((await fetch(base + path)).status, 200, path);
    const parentLogin = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "parent-password-must-not-be-used" }),
    });
    assert.equal(parentLogin.status, 401);

    // サーバー側の外部通信（note の RSS）も止まる。設定はこの実行の一時DBにだけ入れる。
    const client = createClient({ url: `file:${join(runDir, "smoke.db")}` });
    await client.execute("INSERT INTO site_settings (key, value) VALUES ('noteEnabled','on'), ('noteUsername','smoke-egress-probe')");
    client.close();
    const note = await fetch(`${base}/api/note-posts`);
    assert.equal(note.status, 200);
    assert.deepEqual((await note.json()).posts, []);
    const after = await waitForReady(`${base}/__smoke/isolation`, run);
    assert.ok(
      (after.blockedConnections as { host: string }[]).some((c) => c.host === "note.com"),
      JSON.stringify(after.blockedConnections),
    );

    assert.equal(db.count() + pg.count() + storageTrap.count(), 0);
    assert.equal(existsSync(runDir), true);
  } finally {
    await stopGroup(run);
    await Promise.all([db.close(), pg.close(), storageTrap.close()]);
  }
  assert.equal(existsSync(runDir), false, "the run folder is removed");
  assert.equal(await listening(webPort), false, "the dev server is stopped");
  assert.equal(await listening(storagePort), false, "the storage stub is stopped");
});

test("vite itself refuses to start in smoke mode with unsafe settings", async () => {
  const db = await trap();
  const storageTrap = await trap();
  const port = await freePort();
  const runDir = newRunDir();
  const child = spawn(
    "node",
    [join(webDir, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort"],
    {
      cwd: webDir,
      env: baseEnv({
        PORTFOLIO_SMOKE_ISOLATION: "1",
        SMOKE_RUN_DIR: runDir,
        SMOKE_STORAGE_PORT: String(storageTrap.port),
        DATABASE_URL: `libsql://127.0.0.1:${db.port}`,
        DATABASE_AUTH_TOKEN: "dummy-token",
        ADMIN_PASSWORD: "smoke-only-0123456789abcdef01",
        S3_ENDPOINT: `http://127.0.0.1:${storageTrap.port}`,
        S3_BUCKET: "smoke-fixtures",
      }),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout!.on("data", (c) => (output += c));
  child.stderr!.on("data", (c) => (output += c));
  const code = await Promise.race([
    new Promise<number | null>((r) => child.once("exit", r)),
    new Promise<"running">((r) => setTimeout(() => r("running"), 30_000)),
  ]);
  if (code === "running") child.kill("SIGKILL");
  try {
    assert.notEqual(code, "running", "vite must not keep running");
    assert.notEqual(code, 0);
    assert.match(output, /\[smoke-isolation\] vite\.config\.ts/);
    assert.equal(await listening(port), false);
    assert.equal(db.count() + storageTrap.count(), 0);
  } finally {
    await Promise.all([db.close(), storageTrap.close()]);
  }
});

test("an existing server on the smoke port is neither reused nor stopped", async () => {
  const hits: string[] = [];
  const existing = http.createServer((req, res) => {
    hits.push(req.url ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
  });
  await new Promise<void>((r) => existing.listen(0, "127.0.0.1", r));
  const { port } = existing.address() as net.AddressInfo;
  const [storagePort, proxyPort] = [await freePort(), await freePort()];
  const before = new Set((await import("node:fs")).readdirSync(realpathSync(tmpdir())));
  const evidence = evidenceDir();
  try {
    // launcher 単体: 使用中なら 3 で止まる。
    const run = launch(
      baseEnv({
        SMOKE_RUN_DIR: newRunDir(),
        SMOKE_ADMIN_PASSWORD: "smoke-only-0123456789abcdef01",
        SMOKE_WEB_PORT: String(port),
        SMOKE_STORAGE_PORT: String(storagePort),
      }),
    );
    assert.equal(await run.exited, 3, run.output());

    // Playwright 経由: 既存のサーバーを使わずに止まる。
    const pw = spawn(
      join(repoRoot, "node_modules/.bin/playwright"),
      ["test", "--config", "scripts/smoke/playwright.config.ts", "smoke-isolation.spec.ts", "--project=desktop"],
      {
        cwd: repoRoot,
        env: baseEnv({
          SMOKE_WEB_PORT: String(port),
          SMOKE_STORAGE_PORT: String(storagePort),
          SMOKE_EGRESS_PROXY_PORT: String(proxyPort),
          SMOKE_EVIDENCE_DIR: evidence.path,
        }),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    pw.stdout!.on("data", (c) => (output += c));
    pw.stderr!.on("data", (c) => (output += c));
    const code = await new Promise<number | null>((r) => pw.once("exit", r));
    assert.notEqual(code, 0);
    assert.match(output, /is already used/);
    assert.doesNotMatch(output, /passed/);

    const still = await fetch(`http://127.0.0.1:${port}/still-here`);
    assert.equal(still.status, 200, "the existing server keeps running");
  } finally {
    await new Promise((r) => existing.close(r));
    evidence.remove();
  }
  const after = (await import("node:fs")).readdirSync(realpathSync(tmpdir()));
  const leftovers = after.filter((name) => name.startsWith("portfolio-smoke-") && !before.has(name));
  assert.deepEqual(leftovers, []);
});

test("connection variables from the calling shell are removed before tests run", async () => {
  const trapDb = await trap();
  const [webPort, storagePort, proxyPort] = [await freePort(), await freePort(), await freePort()];
  const before = new Set((await import("node:fs")).readdirSync(realpathSync(tmpdir())));
  const evidence = evidenceDir();
  const pw = spawn(
    join(repoRoot, "node_modules/.bin/playwright"),
    ["test", "--config", "scripts/smoke/playwright.config.ts", "smoke-isolation.spec.ts", "--project=desktop", "-g", "接続情報・資格情報が残っていない|この実行の一時SQLiteと偽ストレージ"],
    {
      cwd: repoRoot,
      env: baseEnv({
        SMOKE_WEB_PORT: String(webPort),
        SMOKE_STORAGE_PORT: String(storagePort),
        SMOKE_EGRESS_PROXY_PORT: String(proxyPort),
        SMOKE_EVIDENCE_DIR: evidence.path,
        // `bun run smoke` が .env から読み込んだ想定のダミー値。
        DATABASE_URL: `libsql://127.0.0.1:${trapDb.port}`,
        DATABASE_AUTH_TOKEN: "dummy-token",
        S3_ENDPOINT: "https://dummy.r2.cloudflarestorage.invalid",
        S3_SECRET_ACCESS_KEY: "dummy-secret",
        ADMIN_PASSWORD: "parent-password-must-not-be-used",
        AI_GATEWAY_API_KEY: "dummy-key",
      }),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  pw.stdout!.on("data", (c) => (output += c));
  pw.stderr!.on("data", (c) => (output += c));
  const code = await new Promise<number | null>((r) => pw.once("exit", r));
  await trapDb.close();
  evidence.remove();
  assert.equal(code, 0, output);
  assert.match(output, /2 passed/);
  assert.equal(trapDb.count(), 0);
  const after = (await import("node:fs")).readdirSync(realpathSync(tmpdir()));
  assert.deepEqual(after.filter((name) => name.startsWith("portfolio-smoke-") && !before.has(name)), []);
});
