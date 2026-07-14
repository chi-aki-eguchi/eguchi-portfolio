import sharp from "sharp";

export const DYNAMIC_FAVICON_PATHS = [
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-v2.svg",
  "/favicon-v2.ico",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
] as const;

export type DynamicFaviconPath = (typeof DYNAMIC_FAVICON_PATHS)[number];

type FaviconAsset = {
  body: Buffer;
  contentType: "image/svg+xml" | "image/png" | "image/x-icon";
};

const PNG_SIZE_BY_PATH: Record<DynamicFaviconPath, number> = {
  "/favicon.svg": 64,
  "/favicon.ico": 48,
  "/favicon-v2.svg": 64,
  "/favicon-v2.ico": 48,
  "/apple-touch-icon.png": 180,
  "/icon-192.png": 192,
  "/icon-512.png": 512,
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function monogramLetter(siteName: string | undefined): string {
  return Array.from(siteName?.trim() ?? "")[0] ?? "P";
}

export function buildMonogramSvg(siteName?: string): string {
  const letter = escapeXml(monogramLetter(siteName));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4f1ea"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" fill="#1a1917" font-family="Georgia, 'Times New Roman', serif" font-size="35" font-weight="400">${letter}</text></svg>`;
}

export function buildPhotoFaviconSvg(png: Buffer): string {
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><image href="${dataUri}" width="64" height="64"/></svg>`;
}

export function wrapPngInIco(png: Uint8Array, size = 48): Uint8Array {
  if (!Number.isInteger(size) || size < 1 || size > 256) {
    throw new RangeError("ICO size must be an integer from 1 to 256");
  }
  const headerSize = 6;
  const entrySize = 16;
  const out = new Uint8Array(headerSize + entrySize + png.byteLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  out[6] = size === 256 ? 0 : size;
  out[7] = size === 256 ? 0 : size;
  out[8] = 0;
  out[9] = 0;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.byteLength, true);
  view.setUint32(18, headerSize + entrySize, true);
  out.set(png, headerSize + entrySize);
  return out;
}

export function profileStorageKey(profilePhotoUrl: string): string | null {
  const prefix = "/api/images/";
  if (!profilePhotoUrl.startsWith(prefix)) return null;
  const encodedKey = profilePhotoUrl.slice(prefix.length).split(/[?#]/, 1)[0];
  if (!encodedKey) return null;
  try {
    const key = decodeURIComponent(encodedKey);
    return key.startsWith("profile/") ? key : null;
  } catch {
    return null;
  }
}

async function squarePng(input: Buffer, size: number): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: size, height: size, fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

function assetFromPng(path: DynamicFaviconPath, png: Buffer): FaviconAsset {
  if (path.endsWith(".svg")) {
    return {
      body: Buffer.from(buildPhotoFaviconSvg(png)),
      contentType: "image/svg+xml",
    };
  }
  if (path.endsWith(".ico")) {
    return {
      body: Buffer.from(wrapPngInIco(png, 48)),
      contentType: "image/x-icon",
    };
  }
  return { body: png, contentType: "image/png" };
}

async function monogramAsset(
  path: DynamicFaviconPath,
  siteName: string | undefined,
): Promise<FaviconAsset> {
  const svg = buildMonogramSvg(siteName);
  if (path.endsWith(".svg")) {
    return { body: Buffer.from(svg), contentType: "image/svg+xml" };
  }
  const png = await squarePng(Buffer.from(svg), PNG_SIZE_BY_PATH[path]);
  return assetFromPng(path, png);
}

export async function generateFaviconAsset(
  path: DynamicFaviconPath,
  settings: Record<string, string>,
  loadProfileImage: (key: string) => Promise<Buffer>,
  onProfileError: (error: unknown) => void = () => {},
): Promise<FaviconAsset> {
  const profileUrl = settings.profilePhotoUrl?.trim();
  if (profileUrl) {
    const key = profileStorageKey(profileUrl);
    if (!key) {
      onProfileError(new Error("profilePhotoUrl is not a managed profile image"));
    } else {
      try {
        const original = await loadProfileImage(key);
        const png = await squarePng(original, PNG_SIZE_BY_PATH[path]);
        return assetFromPng(path, png);
      } catch (error) {
        onProfileError(error);
      }
    }
  }
  return monogramAsset(path, settings.siteName);
}
