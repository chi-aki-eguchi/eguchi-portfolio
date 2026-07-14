import sharp from "sharp";

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
  const safeTitle = escapeXml(title.trim() || "Photography");
  const fontSize = titleFontSize(title.trim() || "Photography");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#f4f1ea"/><rect x="42" y="42" width="1116" height="546" fill="none" stroke="#1a1917" stroke-width="1"/><text x="600" y="315" text-anchor="middle" dominant-baseline="central" fill="#1a1917" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="400" letter-spacing="1">${safeTitle}</text><text x="600" y="535" text-anchor="middle" fill="#1a1917" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="400" letter-spacing="5">PHOTOGRAPHY</text></svg>`;
}

export async function generateOgCardPng(title: string): Promise<Buffer> {
  return sharp(Buffer.from(buildOgCardSvg(title))).png().toBuffer();
}
