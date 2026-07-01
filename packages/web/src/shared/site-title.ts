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
