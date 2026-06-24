type SrcSetEntry = { w: number; q: number };

const GRID_WIDTHS: SrcSetEntry[] = [
  { w: 400, q: 82 },
  { w: 800, q: 84 },
  { w: 1200, q: 84 },
  { w: 1600, q: 86 },
];

const HERO_WIDTHS: SrcSetEntry[] = [
  { w: 640, q: 88 },
  { w: 1024, q: 88 },
  { w: 1536, q: 88 },
  { w: 2400, q: 88 },
];

const LIGHTBOX_WIDTHS: SrcSetEntry[] = [
  { w: 800, q: 82 },
  { w: 1200, q: 85 },
  { w: 1600, q: 85 },
  { w: 1920, q: 85 },
];

export type ImagePreset = "grid" | "hero" | "lightbox";

function widthsFor(preset: ImagePreset): SrcSetEntry[] {
  switch (preset) {
    case "hero": return HERO_WIDTHS;
    case "lightbox": return LIGHTBOX_WIDTHS;
    default: return GRID_WIDTHS;
  }
}

export function srcSetFor(url: string, preset: ImagePreset, fmt?: "avif" | "webp"): string {
  const fmtSuffix = fmt ? `&fmt=${fmt}` : "";
  return widthsFor(preset)
    .map(({ w, q }) => `${url}?w=${w}&q=${q}${fmtSuffix} ${w}w`)
    .join(", ");
}

export function srcFor(url: string, w: number, q: number, fmt?: "avif" | "webp"): string {
  const fmtSuffix = fmt ? `&fmt=${fmt}` : "";
  return `${url}?w=${w}&q=${q}${fmtSuffix}`;
}
