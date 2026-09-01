// i18n Phase 3: 公開サイトの英語導線(hreflang / sitemapの/en/* / ヘッダーJP|EN)を
// 有効化する条件。配布テンプレートで英語文を一つも入力していないサイトが
// 「英語版あり」と検索エンジンへ主張して重複コンテンツ扱いされないためのガード。
// contactEnglishNote は JP ページにも常時出す添え書きで、英語版ページの存在を
// 意味しないため判定に含めない。
export const PUBLIC_EN_CONTENT_KEYS = [
  "profileBioEn",
  "profileStatementEn",
  "contactIntroEn",
  "contactNoteEn",
  "contactFlowEn",
  "contactAreasEn",
] as const;

export function hasPublicEnglishContent(
  settings: Record<string, string | undefined>,
): boolean {
  return PUBLIC_EN_CONTENT_KEYS.some(
    (key) => (settings[key] ?? "").trim() !== "",
  );
}
