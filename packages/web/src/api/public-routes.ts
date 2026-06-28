const SPA_STATIC_PATHS = new Set([
  "/",
  "/gallery",
  "/series",
  "/about",
  "/profile",
  "/contact",
  "/service",
  "/admin",
  "/admin/login",
]);

export function isSeriesDetailPath(pathname: string): boolean {
  return /^\/series\/[^/]+$/.test(pathname);
}

export function isKnownSpaPath(pathname: string): boolean {
  return SPA_STATIC_PATHS.has(pathname) || isSeriesDetailPath(pathname);
}

export function htmlStatusForSpaPath(
  pathname: string,
  options: { seriesFound?: boolean } = {},
): number {
  if (isSeriesDetailPath(pathname)) return options.seriesFound ? 200 : 404;
  return SPA_STATIC_PATHS.has(pathname) ? 200 : 404;
}
