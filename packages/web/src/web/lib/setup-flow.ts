// 初回セットアップの着地判定。画面を表示しただけでは何も書き込まない —
// setupCompleted は「セットアップ完了 → ライブラリへ」ボタンの明示操作で
// のみ true になる。以前の「写真があれば裏で完了扱いにする」自動バック
// フィルは 2026-07-10 にオーナー承認のもと削除した。そのため写真あり・
// 未完了のサイトでも初回1回だけ「はじめに」に着地する(意図した挙動)。
export function shouldLandOnSetup(
  authenticated: boolean | undefined,
  settings: Record<string, string> | undefined,
): boolean {
  if (authenticated !== true) return false;
  if (settings === undefined) return false;
  return settings.setupCompleted !== "true";
}
