import { createHash, timingSafeEqual } from "node:crypto";
import { IMAGE_UPLOAD_MAX_BYTES } from "../shared/upload-limits";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/x-tiff",
  "image/avif",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "tif",
  "tiff",
  "avif",
]);

const EXTENSION_ONLY_IMAGE_EXTENSIONS = new Set(["tif", "tiff"]);

export const IMAGE_MAX_BYTES = IMAGE_UPLOAD_MAX_BYTES;
export const FONT_MAX_BYTES = 2 * 1024 * 1024;

export const IMAGE_PROXY_ALLOWED_PREFIXES = [
  "photos/",
  "thumbs/",
  "medium/",
  "hero/",
  "profile/",
  "fonts/",
];

export function isAllowedImageKey(decodedKey: string): boolean {
  return IMAGE_PROXY_ALLOWED_PREFIXES.some((p) => decodedKey.startsWith(p));
}

export function isAllowedUploadImageFile(file: {
  name?: string;
  type?: string;
}): boolean {
  const type = file.type?.toLowerCase() ?? "";
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  if (type && ALLOWED_IMAGE_TYPES.has(type)) return true;
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return false;
  return (
    EXTENSION_ONLY_IMAGE_EXTENSIONS.has(ext) &&
    (!type || type === "application/octet-stream")
  );
}

// アップロードキーのベース名。R2 キー自体はほぼ任意の文字を受けるが、
// URL の区切り文字(# ? % & 等)が混ざるとプロキシ URL がその位置で
// 途切れ、アップロード成功後も画像が永遠に 404 になる(フォント
// アップロードは以前から別途サニタイズ済み)。日本語などの文字・数字は
// URL エンコードで安全に往復できるため残し、それ以外を "_" に置換する。
export function sanitizeUploadBaseName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/[^\p{L}\p{N}._-]/gu, "_");
  return cleaned || "upload";
}

export function clientIpFrom(
  xForwardedFor: string | undefined,
  xRealIp: string | undefined,
): string {
  return (
    (() => {
      const parts = xForwardedFor?.split(",");
      return parts?.[parts.length - 1]?.trim();
    })() ||
    xRealIp ||
    "unknown"
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

// Public/private flags must be actual JSON booleans. JavaScript's truthiness
// would turn a string such as "false" into true and accidentally publish data.
export function parseStrictBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

export function clampImageHeight(raw: string | undefined): number | null {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 50), 3200) : null;
}

export function clampImageQuality(raw: string | undefined): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 10), 100) : 90;
}
