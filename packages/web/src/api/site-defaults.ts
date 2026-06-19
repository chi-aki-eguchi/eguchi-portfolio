export const DEFAULT_SITE_URL = (process.env.DEFAULT_SITE_URL || "https://akieguchi.com").replace(/\/+$/, "");

export const SITE_DEFAULTS = {
  siteName: process.env.DEFAULT_SITE_NAME ?? "江口秋",
  siteNameEn: process.env.DEFAULT_SITE_NAME_EN ?? "Aki Eguchi",
  siteDescription: process.env.DEFAULT_SITE_DESCRIPTION ?? "東京を拠点に活動する写真家・江口秋のポートフォリオ。宣材・ポートレート撮影のご依頼を受け付けています",
  profileName: process.env.DEFAULT_PROFILE_NAME ?? process.env.DEFAULT_SITE_NAME ?? "江口秋",
  profileNameKata: process.env.DEFAULT_PROFILE_NAME_KATA ?? "エグチアキ",
  profileNameEn: process.env.DEFAULT_PROFILE_NAME_EN ?? process.env.DEFAULT_SITE_NAME_EN ?? "Aki Eguchi",
  profileBio: process.env.DEFAULT_PROFILE_BIO ?? "東京を拠点に活動するフォトグラファー。",
};

function originFrom(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function configuredOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const value of [
    process.env.SITE_URL,
    process.env.DEFAULT_SITE_URL,
    DEFAULT_SITE_URL,
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
  ]) {
    const origin = originFrom(value);
    if (!origin) continue;
    origins.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname === "akieguchi.com") origins.add(`${url.protocol}//www.akieguchi.com`);
      if (url.hostname === "www.akieguchi.com") origins.add(`${url.protocol}//akieguchi.com`);
    } catch {
      // Non-URL values are kept verbatim above.
    }
  }
  return origins;
}

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (LOCAL_ORIGIN_RE.test(origin)) return true;
  return configuredOrigins().has(originFrom(origin) ?? "");
}

export function gaMeasurementIdForSite(siteUrl: string): string {
  if (process.env.GA_MEASUREMENT_ID !== undefined) return process.env.GA_MEASUREMENT_ID.trim();
  try {
    const host = new URL(siteUrl).hostname;
    if (host === "akieguchi.com" || host === "www.akieguchi.com") return "G-NKECCDLXYD";
  } catch {
    // Invalid site URLs simply disable analytics unless explicitly configured.
  }
  return "";
}
