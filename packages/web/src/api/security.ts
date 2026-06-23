import { createHash, timingSafeEqual } from "node:crypto";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/avif",
]);

export const IMAGE_MAX_BYTES = 60 * 1024 * 1024;
export const FONT_MAX_BYTES = 2 * 1024 * 1024;

export const IMAGE_PROXY_ALLOWED_PREFIXES = [
  "photos/",
  "hero/",
  "profile/",
  "fonts/",
];

export function isAllowedImageKey(decodedKey: string): boolean {
  return IMAGE_PROXY_ALLOWED_PREFIXES.some((p) => decodedKey.startsWith(p));
}

export function clientIpFrom(
  xForwardedFor: string | undefined,
  xRealIp: string | undefined,
): string {
  return (
    xForwardedFor?.split(",").at(-1)?.trim() || xRealIp || "unknown"
  );
}

export function passwordMatches(
  input: unknown,
  adminPassword: string | undefined,
): boolean {
  if (!adminPassword || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(adminPassword).digest();
  return timingSafeEqual(a, b);
}

export function isHttpsRequest(
  xForwardedProto: string | undefined,
  requestUrl: string,
): boolean {
  if (xForwardedProto) return xForwardedProto.split(",")[0].trim() === "https";
  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILS = 10;

export function clampImageWidth(raw: string | undefined): number | null {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 50), 3200) : null;
}

export function clampImageQuality(raw: string | undefined): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 10), 100) : 90;
}
