import { usableContactEmail } from "./contact-settings";

const SERVICE_HOST = "akieguchi.com";
const SERVICE_OWNER_EMAIL = "akieguchi33@gmail.com";

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
