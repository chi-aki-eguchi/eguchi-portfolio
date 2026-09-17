// 番人テストの起動条件（node-support.mjs）と、package.json の入口（2026-09-17 のレビュー R4）。
// ここで確かめるのは版ごとの判定だけ。実際に Node 22 系で通したかどうかは別に記録する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { guardNodeFlags } from "./node-support.mjs";

test("each Node version gets the flags it needs, or a clear refusal", () => {
  const flag = { ok: true, flags: ["--experimental-strip-types"] };
  const plain = { ok: true, flags: [] };
  const cases: [string, unknown][] = [
    ["v22.12.0", flag],
    ["v22.16.0", flag],
    ["v22.17.1", flag],
    ["v22.18.0", plain],
    ["v22.21.1", plain],
    ["v23.5.0", flag],
    ["v23.6.0", plain],
    ["v24.16.0", plain],
    ["v26.0.0", plain],
  ];
  for (const [version, expected] of cases) assert.deepEqual(guardNodeFlags(version), expected, version);
  for (const version of ["v22.11.0", "v22.6.0", "v22.0.0", "v20.19.0", "v18.20.4", "unknown"]) {
    const result = guardNodeFlags(version);
    assert.equal(result.ok, false, version);
    assert.match((result as { reason: string }).reason, /22\.12\.0 以上|版を読めない/, version);
  }
});

test("package.json runs the guard tests through the version-aware entry", () => {
  const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../package.json"), "utf8"));
  assert.equal(pkg.engines.node, "22.x");
  assert.equal(pkg.scripts["test:smoke-guard"], "node scripts/smoke/guard/run.mjs");
  assert.match(pkg.scripts.check, /bun run test:smoke-guard/);
});

test("Playwright is the release that loads relative imports on Node 22.18", () => {
  // 1.61.0 は Node 22.18.0 で相対 import を含む spec・設定を読めなかった（2026-09-17 に実測）。
  const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../package.json"), "utf8"));
  const pinned = pkg.devDependencies["@playwright/test"];
  assert.equal(pinned, "1.61.1");
  assert.equal(pkg.devDependencies.playwright, pinned);
  const require = createRequire(import.meta.url);
  const installed = (name: string, from?: string) =>
    require(require.resolve(`${name}/package.json`, from ? { paths: [from] } : undefined)).version;
  const playwrightDir = dirname(require.resolve("playwright/package.json"));
  assert.deepEqual(
    [installed("@playwright/test"), installed("playwright"), installed("playwright-core", playwrightDir)],
    [pinned, pinned, pinned],
  );
});
