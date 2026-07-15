const SPA_STATIC_PATHS = new Set([
  "/",
  "/gallery",
  "/series",
  "/about",
  "/profile",
  "/contact",
  "/portfolio-kit",
  "/portfolio-kit/start",
  "/admin",
  "/admin/login",
]);

const LEGACY_PORTFOLIO_KIT_PATHS: Record<string, string> = {
  "/service": "/portfolio-kit",
  "/service/start": "/portfolio-kit/start",
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
