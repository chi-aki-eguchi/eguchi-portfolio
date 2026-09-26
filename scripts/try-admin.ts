// 管理画面を、本番に触れずに手元で試すための入口（2026-09-26）。
//
//   bun run try:admin   → http://localhost:5299/admin
//
// - smoke と同じ隔離サーバー（scripts/smoke/isolated-server.ts）を起動する。
//   一時フォルダの SQLite・人工データ（色の付いた見本の写真）・手元の偽の保存先で
//   動き、本番のデータベース・写真の保存先・`.env` には一切つながらない。
// - 見た目は「写真中心」にしておく。保存・並べ替え・シリーズへの出し入れ・取り込みを
//   自由に試してよい。Ctrl+C で止めると一時フォルダごと消える。
// - パスワードは起動のたびに作る使い捨て（試すためだけの値）。
import { spawn } from "node:child_process";
import { mkdtempSync, rmdirSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import {
  SMOKE_PASSWORD_PREFIX,
  SMOKE_RUN_DIR_PREFIX,
  smokeDatabasePath,
} from "../packages/web/vite/smoke-isolation.ts";

const WEB_PORT = 5299;
const STORAGE_PORT = 5298;

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

for (const port of [WEB_PORT, STORAGE_PORT]) {
  if (!(await portFree(port))) {
    console.error(`ポート ${port} が使われています。前に起動した try:admin を止めてから、もう一度実行してください。`);
    process.exit(1);
  }
}

const base = (process.env.TMPDIR || tmpdir()).replace(/\/$/, "");
const runDir = mkdtempSync(join(base, SMOKE_RUN_DIR_PREFIX));
rmdirSync(runDir); // 隔離サーバーが自分で作り、終わるときに消す。
const password = `${SMOKE_PASSWORD_PREFIX}${randomBytes(12).toString("hex")}`;

const env: Record<string, string> = {
  SMOKE_RUN_DIR: runDir,
  SMOKE_ADMIN_PASSWORD: password,
  SMOKE_WEB_PORT: String(WEB_PORT),
  SMOKE_STORAGE_PORT: String(STORAGE_PORT),
};
for (const key of ["PATH", "TMPDIR", "LANG", "LC_ALL", "TERM"])
  if (process.env[key]) env[key] = process.env[key]!;

const child = spawn("bun", ["--no-env-file", "scripts/smoke/isolated-server.ts"], {
  cwd: join(import.meta.dir, ".."),
  env,
  stdio: ["ignore", "pipe", "inherit"],
});

let announced = false;
child.stdout.on("data", async (chunk: Buffer) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (announced || !text.includes("[smoke-server] ready")) return;
  announced = true;
  const db = createClient({ url: `file:${smokeDatabasePath(runDir)}` });
  await db.execute({
    sql: "INSERT INTO site_settings (key, value) VALUES ('siteDesign', 'book') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [],
  });
  db.close();
  console.log(`
────────────────────────────────────────
  管理画面を試す（人工データ・本番には触れません）
    http://localhost:${WEB_PORT}/admin
    パスワード: ${password}
  公開サイトの見え方:  http://localhost:${WEB_PORT}/
  止めるときは Ctrl+C（一時データは消えます）
────────────────────────────────────────
`);
});

const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
