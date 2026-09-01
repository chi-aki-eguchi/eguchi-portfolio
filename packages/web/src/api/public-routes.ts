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

/**
 * www とアポックス（www 無し）のどちらか一方へ寄せるためのリダイレクト先。
 * 寄せる必要が無ければ null。
 *
 * **なぜ要るか。**基準URL（`settings.siteUrl` / `SITE_URL`）が空のとき、
 * `siteUrlFrom` はリクエストのホストをそのまま基準にする。その結果
 * `www.akieguchi.com` は canonical も og:url も sitemap も JSON-LD も
 * **自分自身（www）を指す完全な別サイト**として応答していた（2026-09-01 実測）。
 * apex 側も自分を指すので、互いを指さない2つのサイトが並ぶ。検索側から見て
 * 中身が同じ2サイトで、評価がそこで割れる。
 *
 * **安全弁: 「www が付いているかどうかだけが違う、同じホスト」しか飛ばさない。**
 * 基準URLに無関係な値や打ち間違いが入っていても、存在しないホストへ飛ばして
 * サイトを開けなくすることが無い。基準URLが空のときは何もしない（空のときに
 * リクエスト元へ飛ばすと自分自身へのループになる）。
 */
export function canonicalHostRedirect(
  requestUrl: string,
  canonicalOrigin: string | undefined,
): string | null {
  if (!canonicalOrigin) return null;
  let target: URL;
  let current: URL;
  try {
    target = new URL(canonicalOrigin);
    current = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!target.host || target.host === current.host) return null;
  const strip = (h: string) => h.replace(/^www\./i, "");
  // 同じ登録ドメインで、www の有無だけが違うときに限る。
  if (strip(target.host) !== strip(current.host)) return null;
  current.protocol = target.protocol;
  current.host = target.host;
  return current.toString();
}
