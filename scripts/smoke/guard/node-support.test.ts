// 番人テストの起動条件（node-support.mjs）と、package.json の入口（2026-09-17 のレビュー R4）。
// ここで確かめるのは版とモジュールフックの値ごとの判定だけ。実際に Node 22 系で通したかどうかは別に記録する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nodeModule from "node:module";
import { resolve } from "node:path";
import { guardNodeFlags, requireHookConditions } from "./node-support.mjs";

test("each Node version gets the flags it needs, or a clear refusal", () => {
  const flag = { ok: true, flags: ["--experimental-strip-types"] };
  const plain = { ok: true, flags: [] };
  const cases: [string, "none" | "array", unknown][] = [
    ["v22.12.0", "none", flag],
    ["v22.16.0", "array", flag],
    ["v22.17.1", "array", flag],
    ["v22.18.0", "array", plain],
    ["v22.21.1", "array", plain],
    ["v23.5.0", "array", flag],
    ["v23.6.0", "array", plain],
    ["v24.16.0", "array", plain],
    ["v26.0.0", "array", plain],
  ];
  for (const [version, hooks, expected] of cases)
    assert.deepEqual(guardNodeFlags(version, hooks), expected, version);
  for (const version of ["v22.11.0", "v22.6.0", "v22.0.0", "v20.19.0", "v18.20.4", "unknown"]) {
    const result = guardNodeFlags(version, "none");
    assert.equal(result.ok, false, version);
    assert.match((result as { reason: string }).reason, /22\.12\.0 以上|版を読めない/, version);
  }
});

test("a Node whose module hooks Playwright cannot use is refused, whatever its version", () => {
  // 2026-09-17: Node 22.18.0 は require の解決で conditions を Set で渡し、Playwright 1.61 が読めなかった。
  for (const version of ["v22.18.0", "v22.15.0", "v24.16.0"]) {
    const broken = guardNodeFlags(version, "not-array");
    assert.equal(broken.ok, false, version);
    assert.match((broken as { reason: string }).reason, /Playwright 1\.61 が相対 import を含む/, version);
    const unknown = guardNodeFlags(version, "unknown");
    assert.equal(unknown.ok, false, version);
    assert.match((unknown as { reason: string }).reason, /確かめられない/, version);
  }
});

test("the hook probe reports what this Node actually does", () => {
  // ここまで来た Node は run.mjs の判定を通っているので、フックが無いか配列で渡すかのどちらか。
  const expected = typeof (nodeModule as { registerHooks?: unknown }).registerHooks === "function" ? "array" : "none";
  assert.equal(requireHookConditions(process.execPath), expected);
  assert.equal(requireHookConditions("/nonexistent/node"), "unknown");
});

test("package.json runs the guard tests through the version-aware entry", () => {
  const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../package.json"), "utf8"));
  assert.equal(pkg.engines.node, "22.x");
  assert.equal(pkg.scripts["test:smoke-guard"], "node scripts/smoke/guard/run.mjs");
  assert.match(pkg.scripts.check, /bun run test:smoke-guard/);
});
