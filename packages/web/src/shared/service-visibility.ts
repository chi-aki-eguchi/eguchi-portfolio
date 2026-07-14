const SERVICE_HOST = "akieguchi.com";

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

export function resolveServiceVisibility(
  mode: string | undefined,
  siteUrl: string | undefined,
  windowHost: string | undefined,
): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return (
    hostFromUrl(siteUrl) === SERVICE_HOST ||
    normalizeHost(windowHost) === SERVICE_HOST
  );
}
