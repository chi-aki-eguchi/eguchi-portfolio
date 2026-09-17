// smoke の番人テスト（guard/*.test.ts）を、どの Node でどう起動するか。
//
// package.json の engines は "22.x"。一方で、このテストは次に依る（2026-09-17 のレビュー R4）。
// - TypeScript のまま実行する型除去: 22.6〜22.17 と 23.0〜23.5 は `--experimental-strip-types`
//   が必要。22.18 以降・23.6 以降は既定で有効。
// - launcher.test.ts が Node で起動する Vite 7.3 の条件: `^20.19.0 || >=22.12.0`。
// - Playwright 1.61 は Node に `module.registerHooks` があるとそれで TS を読み、resolve の
//   `context.conditions` を配列として扱う。Node 22.18.0 は require のときに Set を渡すので、
//   相対 import を含む spec・設定を読めない（2026-09-17 に確認。`bun run smoke` 自体も同じ）。
//   どの版まで続くかは調べていないので、版ではなく実際の値を子プロセスで確かめる。
// よって 22 系の下限は 22.12。条件に合わない Node では、黙って飛ばさず理由を出して止める。
// 実行中の Node をそのまま使う（別の版を探したり取りに行ったりはしない）。
import { spawnSync } from "node:child_process";

const MINIMUM = "22.12.0";

function parse(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

const HOOK_PROBE = [
  'const m = require("node:module");',
  'if (!m.registerHooks) process.stdout.write("none");',
  "else {",
  '  let kind = "unknown";',
  '  m.registerHooks({ resolve(s, c, next) { if (s === "node:path") kind = Array.isArray(c.conditions) ? "array" : "not-array"; return next(s, c); } });',
  '  require("node:path");',
  "  process.stdout.write(kind);",
  "}",
].join("\n");

/**
 * その Node の同期モジュールフックが、require の解決で conditions を配列として渡すか。
 * @param {string} execPath 例: process.execPath
 * @returns {"none" | "array" | "not-array" | "unknown"}
 */
export function requireHookConditions(execPath) {
  const result = spawnSync(execPath, ["-e", HOOK_PROBE], { encoding: "utf8", timeout: 10_000 });
  const kind = result.status === 0 ? result.stdout.trim() : "";
  return ["none", "array", "not-array"].includes(kind) ? kind : "unknown";
}

/**
 * @param {string} version 例: process.version
 * @param {"none" | "array" | "not-array" | "unknown"} hookConditions requireHookConditions の結果
 * @returns {{ ok: true, flags: string[] } | { ok: false, reason: string }}
 */
export function guardNodeFlags(version, hookConditions) {
  const parsed = parse(version);
  if (!parsed) return { ok: false, reason: `Node の版を読めない: ${version}` };
  const [major, minor] = parsed;
  if (major < 22 || (major === 22 && minor < 12))
    return {
      ok: false,
      reason: `smoke の番人テストは Node ${MINIMUM} 以上が必要（型除去は 22.6、Vite 7.3 は 22.12 から）。いまは ${version}`,
    };
  if (hookConditions !== "none" && hookConditions !== "array")
    return {
      ok: false,
      reason:
        hookConditions === "not-array"
          ? `Node ${version} のモジュールフックは require の conditions を配列で渡さず、Playwright 1.61 が相対 import を含む smoke の spec・設定を読めない（bun run smoke も同じ）。Node 22.12.0・24.16.0 では確認済み`
          : `Node ${version} のモジュールフックの動きを確かめられない`,
    };
  const stripsByDefault = major >= 24 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
  return { ok: true, flags: stripsByDefault ? [] : ["--experimental-strip-types"] };
}
