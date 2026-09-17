// smoke の接続先検証（packages/web/vite/smoke-isolation.ts）の規則。
// 危険な設定はすべてダミー（.invalid ドメイン・架空の値）で、どこへも接続しない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isolationProblems,
  smokeDatabaseUrl,
} from "../../../packages/web/vite/smoke-isolation.ts";

const runDir = join(realpathSync(tmpdir()), "portfolio-smoke-rules-test");
const PASSWORD = "smoke-only-0123456789abcdef0123";

function safeEnv(): Record<string, string | undefined> {
  return {
    PATH: "/usr/bin",
    TMPDIR: tmpdir(),
    PORTFOLIO_SMOKE_ISOLATION: "1",
    SMOKE_RUN_DIR: runDir,
    SMOKE_STORAGE_PORT: "4313",
    DATABASE_URL: smokeDatabaseUrl(runDir),
    ADMIN_PASSWORD: PASSWORD,
    S3_ENDPOINT: "http://127.0.0.1:4313",
    S3_BUCKET: "smoke-fixtures",
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "smoke-access-key",
    S3_SECRET_ACCESS_KEY: "smoke-secret-key",
    S3_FORCE_PATH_STYLE: "true",
    AWS_CONFIG_FILE: join(runDir, "home/no-aws-config"),
    AWS_SHARED_CREDENTIALS_FILE: join(runDir, "home/no-aws-credentials"),
    AWS_EC2_METADATA_DISABLED: "true",
    GA_MEASUREMENT_ID: "",
  };
}

test("the environment built for smoke passes", () => {
  assert.deepEqual(isolationProblems(safeEnv()), []);
});

const dangerous: [string, Record<string, string | undefined>][] = [
  ["isolation flag missing", { PORTFOLIO_SMOKE_ISOLATION: undefined }],
  ["remote libSQL", { DATABASE_URL: "libsql://smoke-dummy.turso.invalid" }],
  ["another local SQLite file", { DATABASE_URL: "file:/tmp/other.db" }],
  ["run dir outside the temp folder", { SMOKE_RUN_DIR: "/Users/someone/portfolio-smoke-x", DATABASE_URL: "file:/Users/someone/portfolio-smoke-x/smoke.db" }],
  ["run dir without the smoke prefix", { SMOKE_RUN_DIR: join(realpathSync(tmpdir()), "other"), DATABASE_URL: smokeDatabaseUrl(join(realpathSync(tmpdir()), "other")) }],
  ["PostgreSQL provider", { DATABASE_PROVIDER: "postgres" }],
  ["PostgreSQL public URL", { DATABASE_PUBLIC_URL: "postgresql://dummy:dummy@db.invalid:5432/app" }],
  ["database token", { DATABASE_AUTH_TOKEN: "dummy-token" }],
  ["remote object storage", { S3_ENDPOINT: "https://dummy.r2.cloudflarestorage.invalid" }],
  ["storage on another local port", { S3_ENDPOINT: "http://127.0.0.1:9000" }],
  ["storage named by localhost only", { S3_ENDPOINT: "http://localhost:4313" }],
  ["another bucket", { S3_BUCKET: "portfolio-production" }],
  ["public image host", { R2_PUBLIC_URL: "https://images.invalid" }],
  ["password that is not test-only", { ADMIN_PASSWORD: "correct-horse-battery-staple-42" }],
  ["unknown database variable", { TURSO_DATABASE_URL: "libsql://dummy.turso.invalid" }],
  ["unknown cloud variable", { AWS_ENDPOINT_URL_S3: "https://s3.invalid" }],
  ["remote database hidden in another key", { SOME_SERVICE_DSN: "postgres://dummy@db.invalid/app" }],
];

for (const [name, patch] of dangerous) {
  test(`refuses: ${name}`, () => {
    const env = { ...safeEnv(), ...patch };
    const problems = isolationProblems(env);
    assert.ok(problems.length > 0, `${name} should be refused`);
    // 理由に値そのもの（トークン・パスワード・URL）を出さない。
    const text = problems.join("\n");
    for (const value of Object.values(patch))
      if (value && value.length > 8) assert.ok(!text.includes(value), `problem text leaks ${value}`);
  });
}
