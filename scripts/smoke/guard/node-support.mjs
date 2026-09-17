// smoke の番人テスト（guard/*.test.ts）を、どの Node でどう起動するか。
//
// package.json の engines は "22.x"。一方で、このテストは次に依る（2026-09-17 のレビュー R4）。
// - TypeScript のまま実行する型除去: 22.6〜22.17 と 23.0〜23.5 は `--experimental-strip-types`
//   が必要。22.18 以降・23.6 以降は既定で有効。
// - launcher.test.ts が Node で起動する Vite 7.3 の条件: `^20.19.0 || >=22.12.0`。
// よって 22 系の下限は 22.12。それより古い Node では、黙って飛ばさず理由を出して止める。
// 実行中の Node をそのまま使う（別の版を探したり取りに行ったりはしない）。
//
// Playwright 1.61.0 は Node 22.18.0 で相対 import を含む spec・設定を読めなかった（require の解決で
// conditions が Set で渡るため）。1.61.1 で直ったので、その判定はここに置かない（2026-09-18）。

const MINIMUM = "22.12.0";

function parse(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

/**
 * @param {string} version 例: process.version
 * @returns {{ ok: true, flags: string[] } | { ok: false, reason: string }}
 */
export function guardNodeFlags(version) {
  const parsed = parse(version);
  if (!parsed) return { ok: false, reason: `Node の版を読めない: ${version}` };
  const [major, minor] = parsed;
  if (major < 22 || (major === 22 && minor < 12))
    return {
      ok: false,
      reason: `smoke の番人テストは Node ${MINIMUM} 以上が必要（型除去は 22.6、Vite 7.3 は 22.12 から）。いまは ${version}`,
    };
  const stripsByDefault = major >= 24 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
  return { ok: true, flags: stripsByDefault ? [] : ["--experimental-strip-types"] };
}
