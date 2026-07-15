import { bundledFontTextPath } from "./og-card-font";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function titleFontSize(title: string): number {
  const length = Array.from(title).length;
  if (length > 42) return 42;
  if (length > 30) return 50;
  if (length > 20) return 60;
  return 72;
}

export function buildOgCardSvg(title: string): string {
  const resolvedTitle = title.trim() || "Photography";
  const titlePath = bundledFontTextPath(resolvedTitle, {
    centerX: 600,
    centerY: 315,
    fontSize: titleFontSize(resolvedTitle),
    letterSpacing: 1,
  });
  const labelPath = bundledFontTextPath("PHOTOGRAPHY", {
    centerX: 600,
    centerY: 529,
    fontSize: 18,
    letterSpacing: 5,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"><title>${escapeXml(resolvedTitle)}</title><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#f4f1ea"/><rect x="42" y="42" width="1116" height="546" fill="none" stroke="#1a1917" stroke-width="1"/><g fill="#1a1917">${titlePath}${labelPath}</g></svg>`;
}

export async function generateOgCardPng(title: string): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(buildOgCardSvg(title))).png().toBuffer();
}
