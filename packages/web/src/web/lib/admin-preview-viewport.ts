export type PreviewViewport = { width: number; height: number };
export const PREVIEW_DESKTOP: PreviewViewport = { width: 1440, height: 900 };
export const PREVIEW_MOBILE: PreviewViewport = { width: 390, height: 844 };

/** Scale a real viewport as one rectangle. The panel never changes its aspect ratio. */
export function fitPreviewViewport(viewport: PreviewViewport, stage: PreviewViewport) {
  const scale = stage.width > 0 && stage.height > 0
    ? Math.min(1, stage.width / viewport.width, stage.height / viewport.height)
    : 1;
  return { scale, width: viewport.width * scale, height: viewport.height * scale };
}

export function boundedPreviewDimension(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.round(Math.min(3840, Math.max(280, value))) : fallback;
}
