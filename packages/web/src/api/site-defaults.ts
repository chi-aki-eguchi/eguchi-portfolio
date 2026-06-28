export const DEFAULT_SITE_URL = (
  process.env.DEFAULT_SITE_URL || "https://example.com"
).replace(/\/+$/, "");

export const SITE_DEFAULTS = {
  siteName: process.env.DEFAULT_SITE_NAME ?? "Photographer Name",
  siteNameEn: process.env.DEFAULT_SITE_NAME_EN ?? "Photographer Name",
  siteDescription:
    process.env.DEFAULT_SITE_DESCRIPTION ?? "Photography portfolio.",
  profileName:
    process.env.DEFAULT_PROFILE_NAME ??
    process.env.DEFAULT_SITE_NAME ??
    "Photographer Name",
  profileNameKata: process.env.DEFAULT_PROFILE_NAME_KATA ?? "",
  profileNameEn:
    process.env.DEFAULT_PROFILE_NAME_EN ??
    process.env.DEFAULT_SITE_NAME_EN ??
    "Photographer Name",
  profileBio: process.env.DEFAULT_PROFILE_BIO ?? "Photographer.",
};

export function displayNameFrom(settings: Record<string, string>): string {
  return settings.siteName || settings.profileName || SITE_DEFAULTS.siteName;
}

export function displayNameEnFrom(settings: Record<string, string>): string {
  return (
    settings.siteNameEn ||
    settings.profileNameEn ||
    displayNameFrom(settings) ||
    SITE_DEFAULTS.siteNameEn
  );
}

export function siteDescriptionFrom(settings: Record<string, string>): string {
  if (settings.siteDescription) return settings.siteDescription;
  const name = displayNameFrom(settings);
  if (name && name !== SITE_DEFAULTS.siteName)
    return `${name}の写真ポートフォリオ。`;
  return SITE_DEFAULTS.siteDescription;
}

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
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
  ]) {
    const origin = originFrom(value);
    if (!origin) continue;
    origins.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname.startsWith("www.")) {
        origins.add(
          `${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ""}`,
        );
      } else if (
        url.hostname.includes(".") &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
      ) {
        origins.add(
          `${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ""}`,
        );
      }
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

const AKIEGUCHI_GA_MEASUREMENT_ID = "G-NKECCDLXYD";

export function gaMeasurementIdForSite(siteUrl: string): string {
  if (process.env.GA_MEASUREMENT_ID !== undefined) {
    return process.env.GA_MEASUREMENT_ID.trim();
  }
  return originFrom(siteUrl) === "https://akieguchi.com"
    ? AKIEGUCHI_GA_MEASUREMENT_ID
    : "";
}
