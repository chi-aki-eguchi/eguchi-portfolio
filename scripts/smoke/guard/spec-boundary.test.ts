// smoke の spec が、通信の番人（fixtures.ts）を通らないブラウザ・context・要求を作らないこと。
// これが守られている限り、実際の外部への要求は fixtures.ts の route で止まるか手元で答えられ、
// 遮断プロキシへ届くのは route を通らない先行接続だけになる（egress-proxy.ts の分類の前提）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const smokeDir = resolve(import.meta.dirname, "..");
const specs = readdirSync(smokeDir).filter((name) => name.endsWith(".spec.ts"));
const read = (name: string) => readFileSync(join(smokeDir, name), "utf8");

test("there are spec files to check", () => {
  assert.ok(specs.length >= 40, `found ${specs.length}`);
});

test("every spec takes test/expect from fixtures.ts", () => {
  for (const name of specs) {
    const source = read(name);
    assert.match(source, /^import \{[^}]*\btest\b[^}]*\} from "\.\/fixtures\.ts";$/m, name);
    // 型だけの参照（import("@playwright/test").Page）は通すが、値の import は認めない。
    assert.doesNotMatch(source, /^import [^;]*from ["']@playwright\/test["'];?$/m, name);
  }
});

test("no spec or helper builds its own browser, context, or request client", () => {
  const forbidden = [
    /\bnewContext\s*\(/,
    /\bbrowser\s*\.\s*newPage\s*\(/,
    /\blaunch(?:PersistentContext|Server)?\s*\(/,
    /\bconnectOverCDP\s*\(/,
    /\brequest\s*\.\s*newContext\s*\(/,
    /\b(chromium|firefox|webkit)\s*\./,
    /from ["']playwright(?:-core)?["']/,
  ];
  for (const name of [...specs, "helpers.ts"]) {
    const source = read(name);
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${name}: ${pattern}`);
  }
});

test("the guard is an automatic fixture and the config sends other traffic to the blocking proxy", () => {
  const fixtures = read("fixtures.ts");
  assert.match(fixtures, /networkGuard: \[[\s\S]*\{ auto: true \}/);
  assert.match(fixtures, /context\.route\("\*\*\/\*"/);
  const config = read("playwright.config.ts");
  assert.match(config, /server: `http:\/\/127\.0\.0\.1:\$\{SMOKE_EGRESS_PROXY_PORT\}`/);
  assert.match(config, /bypass: "localhost,127\.0\.0\.1,\[::1\]"/);
  assert.match(config, /reuseExistingServer: false/);
  assert.match(config, /command: "bun --no-env-file scripts\/smoke\/isolated-server\.ts"/);
  assert.match(config, /testMatch: \/\\\.spec\\\.ts\$\//);
});
