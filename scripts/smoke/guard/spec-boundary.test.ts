// smoke の spec が、通信の番人（fixtures.ts）を通らないブラウザ・context・要求を作らないこと。
// これが守られている限り、実際の外部への要求は fixtures.ts の route で止まるか手元で答えられ、
// 遮断プロキシへ届くのは route を通らない先行接続だけになる（egress-proxy.ts の分類の前提）。
// API を直接読むのは fixtures.ts の `api`（smoke-api.ts）だけ（2026-09-17 のレビュー R1）。
// 実行時にも fixtures.ts が page.request / context.request / request fixture を塞ぐ
// （guard/playwright-probes.test.ts）。ここは書き方の段階で見つけるための検査。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const smokeDir = resolve(import.meta.dirname, "..");
const specs = readdirSync(smokeDir).filter((name) => name.endsWith(".spec.ts"));
const probes = readdirSync(join(smokeDir, "guard/probes"))
  .filter((name) => name.endsWith(".probe.ts"))
  .map((name) => `guard/probes/${name}`);
const read = (name: string) => readFileSync(join(smokeDir, name), "utf8");

// Node から直接送る要求クライアント（APIRequestContext）と、route を通らない送信。
const DIRECT_REQUEST = [
  /\b(?:page|context|browserContext|ctx)\s*\.\s*request\b(?!\s*\()/,
  /\)\s*\.\s*request\b(?!\s*\()/,
  /\(\s*\{[^}]*\brequest\b[^}]*\}\s*(?:,\s*\w+\s*)?\)\s*=>/,
  /\bimport\s*\{[^}]*\brequest\b[^}]*\}\s*from/,
  /\bAPIRequestContext\b/,
  /\.\s*fetch\s*\(/,
  /\bplaywright\s*\.\s*request\b/,
];
// このファイルだけは、塞がれていることを確かめるために直接の要求を書く。
const DIRECT_REQUEST_PROBE = "guard/probes/api-boundary.probe.ts";
const directRequestIn = (source: string) => DIRECT_REQUEST.filter((pattern) => pattern.test(source));

test("there are spec files to check", () => {
  assert.ok(specs.length >= 40, `found ${specs.length}`);
});

test("every spec takes test/expect from fixtures.ts", () => {
  for (const name of [...specs, ...probes]) {
    const source = read(name);
    const from = name.startsWith("guard/probes/") ? "\\.\\.\\/\\.\\.\\/fixtures\\.ts" : "\\.\\/fixtures\\.ts";
    assert.match(source, new RegExp(`^import \\{[^}]*\\btest\\b[^}]*\\} from "${from}";$`, "m"), name);
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
  for (const name of [...specs, "helpers.ts", ...probes]) {
    const source = read(name);
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${name}: ${pattern}`);
  }
});

test("the direct-request check catches the known forms and leaves ordinary code alone", () => {
  const caught = [
    'await page.request.get("/api/settings");',
    "const client = page.request;",
    'await context.request.post("/api/admin/settings", { data: {} });',
    '(await page.context()).request.get("/x");',
    'test("t", async ({ page, request }) => {});',
    'test("t", async ({ request }, info) => {});',
    'import { expect, request, test } from "./fixtures.ts";',
    "let client: APIRequestContext;",
    "await route.fetch();",
    "await playwright.request.newContext();",
  ];
  for (const source of caught) assert.notDeepEqual(directRequestIn(source), [], source);
  const ordinary = [
    "const method = route.request().method();",
    'page.on("request", (request) => seen.push(request.url()));',
    "const lines = hits.map((hit) => hit.request);",
    'const res = await api.get("/api/settings");',
    'await page.waitForRequest("**/api/photos");',
    "const res = await fetch(url, init);",
  ];
  for (const source of ordinary) assert.deepEqual(directRequestIn(source), [], source);
});

test("specs, helpers and probes read the API only through the `api` fixture", () => {
  for (const name of [...specs, "helpers.ts", ...probes]) {
    if (name === DIRECT_REQUEST_PROBE) continue;
    assert.deepEqual(directRequestIn(read(name)).map(String), [], name);
  }
  // 例外の probe は、塞がれていることを確かめる以外に使わない。
  assert.match(read(DIRECT_REQUEST_PROBE), /rejects\.toThrow\(blocked\)/);
});

test("specs and helpers open no network connections of their own from Node", () => {
  const found: string[] = [];
  for (const name of [...specs, "helpers.ts"]) {
    const source = read(name);
    assert.doesNotMatch(source, /from\s+["'](?:node:)?(?:net|http|https|http2|tls|dgram)["']/, name);
    assert.doesNotMatch(source, /from\s+["']undici["']|\brequire\s*\(/, name);
    for (const line of source.split("\n"))
      if (/(?<![.\w])fetch\s*\(/.test(line)) found.push(`${name}: ${line.trim()}`);
  }
  // 残る1件は、番人を確かめるテストがブラウザの中（page.evaluate）で呼ぶ fetch。
  // 遮断プロキシの記録は egress-proxy.ts の readEgressProxyHits で読む。
  assert.deepEqual(found, ["smoke-isolation.spec.ts: const res = await fetch(url, init);"]);
});

test("the guard is an automatic fixture and the config sends other traffic to the blocking proxy", () => {
  const fixtures = read("fixtures.ts");
  assert.match(fixtures, /egressLabel: \[[\s\S]*\{ auto: true \}/);
  assert.match(fixtures, /networkGuard: \[[\s\S]*\{ auto: true \}/);
  // spec へ route を通らない `request` などを渡さない。
  assert.doesNotMatch(fixtures, /^export \*/m);
  assert.match(read("smoke-api.ts"), /maxRedirects: 0/);
  assert.match(fixtures, /context\.route\("\*\*\/\*"/);
  const config = read("playwright.config.ts");
  assert.match(config, /server: `http:\/\/127\.0\.0\.1:\$\{SMOKE_EGRESS_PROXY_PORT\}`/);
  assert.match(config, /bypass: "localhost,127\.0\.0\.1,\[::1\]"/);
  assert.match(config, /reuseExistingServer: false/);
  assert.match(config, /command: "bun --no-env-file scripts\/smoke\/isolated-server\.ts"/);
  assert.match(config, /testMatch: \/\\\.spec\\\.ts\$\//);
});
