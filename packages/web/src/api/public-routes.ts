const SPA_STATIC_PATHS = new Set([
  "/",
  "/gallery",
  "/series",
  // Work の棚（2026-08-31）。**ここに無いと HTTP 404 を返す。**画面は SPA が
  // 描くので開いても気づけず、本番で実際にそうなっていた（開発サーバは何でも
  // 200 を返すため、手元でも気づけない）。
  "/work",
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
  // 棚が2つ（`series` / `work`）。1本ぶんのURLは棚で変わるが、**扱いは同じ**
  // ——実在すれば 200、無ければ 404。
  return /^\/(series|work)\/[^/]+$/.test(normalizeSpaPathname(pathname));
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

/**
 * `/series/:slug` / `/work/:slug` を「棚」と「slug」に割る。詳細ページでなければ null。
 *
 * server.ts はここを `/series/` だけで見ていたので、**Work 棚に置いた1本は
 * `/work/:slug` が HTTP 404・noindex・タイトル "Not Found" で返る状態だった**。
 * 画面そのものは正しく描画されるので、ブラウザで見ている限り気づけない。
 * 判定を1か所に集めて、棚が増えても取りこぼさないようにする。
 */
export function seriesDetailRoute(
  pathname: string,
): { shelf: "series" | "work"; slug: string } | null {
  const match = normalizeSpaPathname(pathname).match(
    /^\/(series|work)\/([^/]+)$/,
  );
  if (!match) return null;
  return { shelf: match[1] as "series" | "work", slug: match[2] };
}
