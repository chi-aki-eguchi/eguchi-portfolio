import {
  imageUrlWithParams,
  type ImageFormat,
  type RotationDeg,
} from "../../shared/image-url";
export {
  imageUrlWithParams,
  normalizeRotationDeg,
  objectPositionFromFocal,
  orientedAspectRatio,
  orientedDimensions,
  rotateRotationDeg,
} from "../../shared/image-url";

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

type PhotoImage = { url: string; rotationDeg?: RotationDeg | number | null };

export function srcSetFor(
  url: string,
  preset: ImagePreset,
  fmt?: ImageFormat,
  rotationDeg?: unknown,
): string {
  return widthsFor(preset)
    .map(
      ({ w, q }) =>
        `${imageUrlWithParams(url, { w, q, fmt, rotationDeg })} ${w}w`,
    )
    .join(", ");
}

export function srcFor(
  url: string,
  w: number,
  q: number,
  fmt?: ImageFormat,
  rotationDeg?: unknown,
): string {
  return imageUrlWithParams(url, { w, q, fmt, rotationDeg });
}

export function photoSrcSetFor(
  photo: PhotoImage,
  preset: ImagePreset,
  fmt?: ImageFormat,
): string {
  return srcSetFor(photo.url, preset, fmt, photo.rotationDeg);
}

export function photoSrcFor(
  photo: PhotoImage,
  w: number,
  q: number,
  fmt?: ImageFormat,
): string {
  return srcFor(photo.url, w, q, fmt, photo.rotationDeg);
}
