import { imageUrlWithParams, orientedDimensions } from "./image-url";

export type HeroGeneratedImage = {
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  width?: number | null;
  height?: number | null;
  rotationDeg?: number | null;
};

/** The value must match the actual HeroPicture layout on the public home page. */
export function heroImageSizes(
  heroMode: string | undefined,
  heroDisplayMode?: string,
): string {
  if (heroMode === "editorial") return "(min-width: 768px) 55vw, 100vw";
  if (
    heroMode === "single" ||
    heroMode === "quiet-grid" ||
    heroMode === "immersive"
  )
    return "100vw";
  if (heroDisplayMode === "fullscreen") return "100vw";
  return "(min-width: 1200px) 1152px, 100vw";
}

/** A random first slide cannot be predicted safely by the HTML response. */
export function heroPreloadAllowed(heroRandom: string | undefined): boolean {
  return !heroRandom || heroRandom === "off";
}

/**
 * Prefer upload-time variants over runtime resizes. Width descriptors use the
 * real post-rotation dimensions, so portrait files rotated 90/270 degrees are
 * not advertised as wider than the bytes the browser receives.
 */
export function heroGeneratedSrcSet(photo: HeroGeneratedImage): string {
  const sourceWidth = photo.width;
  const sourceHeight = photo.height;
  if (
    !sourceWidth ||
    !sourceHeight ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  )
    return "";

  const originalWidth = orientedDimensions(
    sourceWidth,
    sourceHeight,
    photo.rotationDeg,
  ).width;
  if (!originalWidth) return "";

  const generatedWidth = (maxWidth: number) => {
    const scale = Math.min(1, maxWidth / sourceWidth);
    const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
    const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
    return (
      orientedDimensions(resizedWidth, resizedHeight, photo.rotationDeg).width ??
      resizedWidth
    );
  };

  const candidates = new Map<number, string>();
  if (photo.thumbUrl) candidates.set(generatedWidth(640), photo.thumbUrl);
  if (photo.mediumUrl) candidates.set(generatedWidth(1920), photo.mediumUrl);

  const largestGeneratedWidth = photo.mediumUrl
    ? generatedWidth(1920)
    : photo.thumbUrl
      ? generatedWidth(640)
      : 0;
  if (originalWidth > largestGeneratedWidth) {
    candidates.set(
      originalWidth,
      imageUrlWithParams(photo.url, { rotationDeg: photo.rotationDeg }),
    );
  }

  if (candidates.size < 2) return "";
  return [...candidates]
    .sort(([a], [b]) => a - b)
    .map(([width, url]) => `${url} ${width}w`)
    .join(", ");
}
