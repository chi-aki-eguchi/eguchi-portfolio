import { usableContactEmail } from "./contact-settings";

const SERVICE_HOST = "akieguchi.com";
const SERVICE_OWNER_EMAIL = "akieguchi33@gmail.com";

const SERVICE_VISIBILITY_GATED_PATHS = new Set([
  "/portfolio-kit",
  "/portfolio-kit/guide",
  "/portfolio-kit/consult",
  "/portfolio-kit/en",
  "/portfolio-kit/start",
  "/start",
  "/start/en",
]);

function normalizeHost(host: string | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/^www\./, "");
}

function hostFromUrl(siteUrl: string | undefined): string {
  if (!siteUrl) return "";
  try {
    return normalizeHost(new URL(siteUrl).hostname);
  } catch {
    return "";
  }
}

export function isServiceOwnerSite(
  siteUrl: string | undefined,
  windowHost: string | undefined,
): boolean {
  return (
    hostFromUrl(siteUrl) === SERVICE_HOST ||
    normalizeHost(windowHost) === SERVICE_HOST
  );
}

export function resolveServiceContactEmail(
  contactEmail: string | undefined,
  siteUrl: string | undefined,
  windowHost: string | undefined,
): string {
  const configuredEmail = usableContactEmail(contactEmail);
  if (configuredEmail) return configuredEmail;
  return isServiceOwnerSite(siteUrl, windowHost) ? SERVICE_OWNER_EMAIL : "";
}

export function resolveServiceVisibility(
  mode: string | undefined,
  siteUrl: string | undefined,
  windowHost: string | undefined,
): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return isServiceOwnerSite(siteUrl, windowHost);
}

export function resolveServiceNavVisibility(mode: string | undefined): boolean {
  return mode === "on";
}

/** Routes that must behave as genuine 404s when Portfolio Kit is not enabled. */
export function isServiceVisibilityGatedPath(pathname: string): boolean {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return SERVICE_VISIBILITY_GATED_PATHS.has(normalized);
}

/**
 * About のページか（日英と、別名の `/profile`）。末尾のスラッシュとクエリを落として見る。
 *
 * 2026-10-07、オーナー「もっとシンプルでわかりやすく、綺麗なサイトにしたい」。
 * 制作の案内（フッターの1行）はここでだけ出す。それまでは Top・Gallery・Series・
 * Work・About の5か所で、作品を見終えた直後に「撮影のご依頼」と並んで出ていた。
 * 作品のページは写真と依頼の入口だけで終え、制作の案内は撮り手を知りたい人が読む
 * About の1か所に置く。Contact に出さないのは前からの決まり（頼もうとしている人の
 * 次の行動と競合する）で、この判定がそのまま守る。
 */
export function isAboutRoute(pathname: string | undefined): boolean {
  const head = (pathname ?? "").split(/[?#]/, 1)[0] || "";
  const normalized = head.replace(/\/+$/, "") || "/";
  return normalized === "/about" || normalized === "/profile" || normalized === "/en/about";
}
