const TRACKABLE_STATIC_PATHS = new Set([
  "/",
  "/gallery",
  "/series",
  "/work",
  "/about",
  "/contact",
  "/en/about",
  "/en/contact",
  "/privacy",
  "/privacy/en",
  "/terms",
  "/terms/en",
  "/portfolio-kit",
  "/portfolio-kit/guide",
  "/portfolio-kit/consult",
  "/portfolio-kit/en",
  "/portfolio-kit/start",
  "/start",
  "/start/en",
]);

/** Remove query/fragment and normalize a route without discarding its identity. */
export function analyticsRoutePath(rawPath: string): string {
  const head = rawPath.split(/[?#]/, 1)[0] || "/";
  return head === "/" ? "/" : head.replace(/\/+$/, "") || "/";
}

/** Compare encoded and decoded forms of the same browser route safely. */
export function comparableAnalyticsRoutePath(rawPath: string): string {
  const routePath = analyticsRoutePath(rawPath);
  try {
    return decodeURIComponent(routePath);
  } catch {
    return routePath;
  }
}

/** Remove query/fragment and collapse identifiers that are not needed in GA. */
export function analyticsPagePath(rawPath: string): string {
  const routePath = analyticsRoutePath(rawPath);
  return /^\/photo\/[1-9]\d{0,8}$/.test(routePath)
    ? "/photo/:id"
    : routePath;
}

/** Dynamic routes need an API success signal before an SPA page view is valid. */
export function isAnalyticsDynamicPath(rawPath: string): boolean {
  const routePath = analyticsRoutePath(rawPath);
  return (
    /^\/(?:series|work)\/[^/]+$/.test(routePath) ||
    /^\/photo\/[1-9]\d{0,8}$/.test(routePath)
  );
}

/** Positive route list: unknown/404 and admin paths must not pollute analytics. */
export function isAnalyticsPublicPath(rawPath: string): boolean {
  const normalized = analyticsPagePath(rawPath);
  return (
    TRACKABLE_STATIC_PATHS.has(normalized) ||
    /^\/(?:series|work)\/[^/]+$/.test(normalized) ||
    normalized === "/photo/:id"
  );
}
