const SPA_STATIC_PATHS = new Set([
  "/",
  "/gallery",
  "/series",
  "/about",
  "/profile",
  "/contact",
  // /en/* は英語文未入力でも直接アクセスでJPフォールバック表示するため常に200
  "/en/about",
  "/en/contact",
  "/portfolio-kit",
  "/portfolio-kit/en",
  "/portfolio-kit/start",
  "/start",
  "/start/en",
  "/admin",
  "/admin/login",
  // LPから誘導する公開デモ。未掲載だと直接アクセス/リロードがHTTP 404になり
  // 監視・リンク検査で「存在しないページ」扱いされる(Codexデバッグ 2026-07-20 P2)
  "/admin/demo",
]);

const LEGACY_PORTFOLIO_KIT_PATHS: Record<string, string> = {
  "/service": "/portfolio-kit",
  "/service/en": "/portfolio-kit/en",
  "/service/start": "/portfolio-kit/start",
  "/service/start/en": "/start/en",
  "/portfolio-kit/start/en": "/start/en",
};

export function normalizeSpaPathname(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function canonicalPortfolioKitPath(pathname: string): string {
  const normalized = normalizeSpaPathname(pathname);
  return LEGACY_PORTFOLIO_KIT_PATHS[normalized] ?? normalized;
}

export function canonicalSpaRedirectUrl(
  requestUrl: string,
  publicOrigin: string,
  pathname: string,
): string {
  const redirectUrl = new URL(requestUrl);
  const origin = new URL(publicOrigin);
  redirectUrl.protocol = origin.protocol;
  redirectUrl.host = origin.host;
  redirectUrl.pathname = normalizeSpaPathname(pathname);
  return redirectUrl.toString();
}

export function isSeriesDetailPath(pathname: string): boolean {
  return /^\/series\/[^/]+$/.test(normalizeSpaPathname(pathname));
}

export function isKnownSpaPath(pathname: string): boolean {
  const normalized = normalizeSpaPathname(pathname);
  return SPA_STATIC_PATHS.has(normalized) || isSeriesDetailPath(normalized);
}

export function htmlStatusForSpaPath(
  pathname: string,
  options: { seriesFound?: boolean } = {},
): number {
  const normalized = normalizeSpaPathname(pathname);
  if (isSeriesDetailPath(normalized)) return options.seriesFound ? 200 : 404;
  return SPA_STATIC_PATHS.has(normalized) ? 200 : 404;
}
