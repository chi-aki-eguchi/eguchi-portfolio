// smoke（Playwright）用の開発サーバーが、本番のDB・保存先へつながらないことを
// 起動前に確かめる。
//
// `scripts/smoke/isolated-server.ts` が、実行ごとの一時フォルダ・一時SQLite・
// 127.0.0.1 の偽ストレージ・テスト専用パスワードだけを入れた環境を一から作り、
// この検証を通ったときだけ Vite を起動する。Vite 側（vite.config.ts）と
// API の入口（plugins/hono-dev-plugin.ts）も同じ検証をもう一度行う。
// **どれか1つでも合わなければ、通信を始める前に止まる。**
//
// URL が localhost というだけでは隔離とみなさない。DB は「この実行の一時フォルダの
// SQLite ファイル」、保存先は「この実行の偽ストレージのポート」と完全に一致した
// ときだけ通す。
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const SMOKE_ISOLATION_FLAG = "PORTFOLIO_SMOKE_ISOLATION";
export const SMOKE_RUN_DIR_PREFIX = "portfolio-smoke-";
export const SMOKE_PASSWORD_PREFIX = "smoke-only-";
export const SMOKE_BUCKET = "smoke-fixtures";
export const SMOKE_ISOLATION_PATH = "/__smoke/isolation";

type Env = Record<string, string | undefined>;

/** 一時フォルダ内の SQLite。DATABASE_URL はこの値の `file:` 形だけを許す。 */
export function smokeDatabasePath(runDir: string): string {
  return join(runDir, "smoke.db");
}

export function smokeDatabaseUrl(runDir: string): string {
  return `file:${smokeDatabasePath(runDir)}`;
}

export function smokeStorageEndpoint(port: string | number): string {
  return `http://127.0.0.1:${port}`;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLoopbackHost(host: string | undefined | null): boolean {
  return !!host && LOOPBACK_HOSTS.has(host.toLowerCase());
}

/** 検証の前提として値が決まっている鍵。空でなければならない鍵もここに並べる。 */
const EXPECTED_KEYS = new Set([
  SMOKE_ISOLATION_FLAG,
  "SMOKE_RUN_DIR",
  "SMOKE_STORAGE_PORT",
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE",
  "AWS_CONFIG_FILE",
  "AWS_SHARED_CREDENTIALS_FILE",
  "AWS_EC2_METADATA_DISABLED",
]);

/** 空であるべき鍵（本番・配布版の接続を切り替える値）。 */
const MUST_BE_EMPTY = [
  "DATABASE_PROVIDER",
  "DATABASE_AUTH_TOKEN",
  "DATABASE_PUBLIC_URL",
  "R2_PUBLIC_URL",
];

// 接続先・資格情報を表しうる鍵の形。上の2つに無いものが値を持っていたら止める。
const CONNECTION_KEY =
  /^(DATABASE|TURSO|LIBSQL|PG|POSTGRES|MYSQL|REDIS|S3|R2|AWS|CLOUDFLARE|RAILWAY)_?/i;
// どの鍵に入っていても、遠隔DBを指す値は認めない。
const REMOTE_DB_VALUE = /\b(libsql|postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\//i;

function realTmpDir(env: Env): string {
  const base = env.TMPDIR || tmpdir();
  try {
    return realpathSync(base);
  } catch {
    return resolve(base);
  }
}

function sameRealPath(a: string, b: string): boolean {
  const real = (p: string) => {
    try {
      return realpathSync(p);
    } catch {
      return resolve(p);
    }
  };
  return real(a) === real(b);
}

/**
 * 問題の一覧。空なら隔離できている。値そのもの（パスワード等）は返さない。
 */
export function isolationProblems(env: Env): string[] {
  const problems: string[] = [];
  if (env[SMOKE_ISOLATION_FLAG] !== "1")
    problems.push(`${SMOKE_ISOLATION_FLAG} が 1 ではない`);

  const runDir = env.SMOKE_RUN_DIR ?? "";
  const runDirOk =
    isAbsolute(runDir) &&
    basename(runDir).startsWith(SMOKE_RUN_DIR_PREFIX) &&
    sameRealPath(dirname(runDir), realTmpDir(env));
  if (!runDirOk)
    problems.push(
      `SMOKE_RUN_DIR は一時フォルダ直下の ${SMOKE_RUN_DIR_PREFIX}* でなければならない`,
    );

  if (!runDirOk || env.DATABASE_URL !== smokeDatabaseUrl(runDir))
    problems.push("DATABASE_URL がこの実行の一時SQLiteを指していない");

  for (const key of MUST_BE_EMPTY)
    if (env[key]) problems.push(`${key} は空でなければならない`);

  const port = env.SMOKE_STORAGE_PORT ?? "";
  if (!/^\d{2,5}$/.test(port))
    problems.push("SMOKE_STORAGE_PORT が数値ではない");
  else if (env.S3_ENDPOINT !== smokeStorageEndpoint(port))
    problems.push("S3_ENDPOINT がこの実行の偽ストレージ（127.0.0.1）を指していない");
  if (env.S3_BUCKET !== SMOKE_BUCKET)
    problems.push(`S3_BUCKET は ${SMOKE_BUCKET} でなければならない`);

  const password = env.ADMIN_PASSWORD ?? "";
  if (!password.startsWith(SMOKE_PASSWORD_PREFIX) || password.length < 24)
    problems.push(
      `ADMIN_PASSWORD はテスト専用（${SMOKE_PASSWORD_PREFIX}…）でなければならない`,
    );

  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (REMOTE_DB_VALUE.test(value))
      problems.push(`${key} が遠隔のDBを指している`);
    else if (
      CONNECTION_KEY.test(key) &&
      !EXPECTED_KEYS.has(key) &&
      !MUST_BE_EMPTY.includes(key)
    )
      problems.push(`${key} は smoke では使わない接続設定`);
  }
  return [...new Set(problems)];
}

export function assertIsolated(env: Env, where: string): void {
  const problems = isolationProblems(env);
  if (problems.length === 0) return;
  throw new Error(
    `[smoke-isolation] ${where}: 本番や外部につながる可能性があるため起動しない。\n- ${problems.join("\n- ")}`,
  );
}
