export interface SiteTitleParts {
  nameJa: string;
  nameEn: string;
  subtitle: string;
}

/**
 * Subpage titles: "Page | Name JA | Name EN | Subtitle". Shared by the
 * server-rendered <title> (api/ogp.ts) and the client document.title
 * (web/hooks/usePageTitle.ts) so they never diverge — a past divergence (the
 * client formula silently dropped the EN name) made GA record different
 * titles for the same URL depending on hydration timing.
 */
export function composeBaseTitle({ nameJa, nameEn, subtitle }: SiteTitleParts): string {
  return [nameJa && nameJa !== nameEn ? nameJa : null, nameEn, subtitle]
    .filter(Boolean)
    .join(" | ");
}

/**
 * Home page: "Name JA | Name EN Subtitle" — the subtitle merges into the EN
 * name without a pipe, read as one lockup ("Aki Eguchi Photography"). Only
 * applies when a JA name distinct from the EN name is configured; otherwise
 * this falls back to the same pipe-joined shape as composeBaseTitle so a
 * single-name site (or the generic template default) doesn't read as two
 * words jammed together ("Photographer Name Photography").
 */
export function composeHomeTitle({ nameJa, nameEn, subtitle }: SiteTitleParts): string {
  const hasDistinctJaName = !!nameJa && nameJa !== nameEn;
  const enSegment =
    hasDistinctJaName && subtitle
      ? `${nameEn} ${subtitle}`.trim()
      : [nameEn, subtitle].filter(Boolean).join(" | ");
  return [hasDistinctJaName ? nameJa : null, enSegment]
    .filter(Boolean)
    .join(" | ");
}

export function composePageTitle(
  page: string | undefined,
  parts: SiteTitleParts,
): string {
  if (!page) return composeHomeTitle(parts);
  return `${page} | ${composeBaseTitle(parts)}`;
}

/**
 * 各ページの題（`<title>` の先頭に来る語）。**サーバ（api/ogp.ts）と画面
 * （web/app.tsx の TitledRoute）の両方がここを読む。**別々に文字列を書くと
 * 静かにズレて、GA が同じURLを2つの題で記録する（過去に実際に起きた）。
 *
 * ここは `<title>` だけで、画面に出る見出しではない（見出しは settings の
 * `contactLabel` などが持つ）。だから検索で使われる語を入れても見た目は変わらない。
 */
export const PAGE_TITLE = {
  gallery: "Gallery",
  series: "Series",
  work: "Work",
  about: "About",
  /**
   * 「Contact」だけでは、撮影を頼みたくて探している人の言葉に一語も当たらない
   * （2026-09-01 実測: 題は "Contact | 江口秋 | Aki Eguchi | Photography" で、
   * 撮影依頼という語はどこにも無かった。説明文には入っていた）。
   */
  contact: "撮影依頼・お問い合わせ",
  /** 英語URLは英語のまま。日本語の語を英語ページの題に混ぜない。 */
  contactEn: "Contact",
  privacy: "プライバシーポリシー",
  privacyEn: "Privacy Policy",
  terms: "利用条件",
  termsEn: "Terms of Use",
  legal: "販売条件・特定商取引法に基づく表記",
  legalEn: "Online Sales Disclosure",
} as const;
