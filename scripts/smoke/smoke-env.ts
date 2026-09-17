// smoke 実行ごとの値。Playwright は設定を親プロセスと各 worker で読み直すので、
// 最初に決めた値を環境変数へ入れ、以後はそれを使う（worker へ引き継がれる）。
import { randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SMOKE_PASSWORD_PREFIX,
  SMOKE_RUN_DIR_PREFIX,
} from "../../packages/web/vite/smoke-isolation.ts";

// `bun run smoke` はリポジトリ直下の `.env` を環境変数へ読み込む。Playwright 本体・
// worker・開発サーバーのどこにも本番の接続情報や資格情報を残さないよう、最初に消す。
// 開発サーバーの環境は isolated-server.ts が一から作るので、ここで消しても困らない。
const SENSITIVE_KEY =
  /^(DATABASE|TURSO|LIBSQL|PG|POSTGRES|MYSQL|REDIS|S3|R2|AWS|CLOUDFLARE|RAILWAY|STRIPE|FORMSPREE|GA)_|ADMIN_PASSWORD|SECRET|TOKEN|API_?KEY|PASSWORD|CREDENTIAL|AUTH/i;

export function scrubSensitiveEnv(env: NodeJS.ProcessEnv): string[] {
  const removed: string[] = [];
  for (const key of Object.keys(env)) {
    if (key.startsWith("SMOKE_")) continue;
    if (SENSITIVE_KEY.test(key)) {
      delete env[key];
      removed.push(key);
    }
  }
  return removed;
}
scrubSensitiveEnv(process.env);

function ensure(key: string, make: () => string): string {
  const value = process.env[key] || make();
  process.env[key] = value;
  return value;
}

export const SMOKE_WEB_PORT = Number(ensure("SMOKE_WEB_PORT", () => "4310"));
export const SMOKE_STORAGE_PORT = Number(ensure("SMOKE_STORAGE_PORT", () => "4313"));
export const SMOKE_EGRESS_PROXY_PORT = Number(ensure("SMOKE_EGRESS_PROXY_PORT", () => "4314"));

export const SMOKE_RUN_DIR = ensure("SMOKE_RUN_DIR", () =>
  join(
    realpathSync(tmpdir()),
    `${SMOKE_RUN_DIR_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`,
  ),
);

export const SMOKE_ADMIN_PASSWORD_ENV = "SMOKE_ADMIN_PASSWORD";
ensure(SMOKE_ADMIN_PASSWORD_ENV, () => `${SMOKE_PASSWORD_PREFIX}${randomBytes(18).toString("hex")}`);

export const SMOKE_BASE_URL = `http://localhost:${SMOKE_WEB_PORT}`;

/** ブラウザから出てよい送り先（この実行の開発サーバーだけ）。 */
export const SMOKE_ALLOWED_ORIGINS = new Set([
  `http://localhost:${SMOKE_WEB_PORT}`,
  `http://127.0.0.1:${SMOKE_WEB_PORT}`,
  `http://[::1]:${SMOKE_WEB_PORT}`,
]);

/** ログインに使うテスト専用パスワード。`.env` は読まない。 */
export function smokeAdminPassword(): string {
  const password = process.env.SMOKE_ADMIN_PASSWORD ?? "";
  if (!password.startsWith(SMOKE_PASSWORD_PREFIX))
    throw new Error(
      "SMOKE_ADMIN_PASSWORD がテスト専用の値ではない。smoke は playwright.config.ts から起動する。",
    );
  return password;
}
