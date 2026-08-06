export type ImageFormat = "avif" | "webp" | "jpeg";
export type RotationDeg = 0 | 90 | 180 | 270;

const ROTATIONS = new Set<number>([0, 90, 180, 270]);

export function normalizeRotationDeg(value: unknown): RotationDeg {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && ROTATIONS.has(n)
    ? (n as RotationDeg)
    : 0;
}

export function rotateRotationDeg(value: unknown, delta: number): RotationDeg {
  const next = (normalizeRotationDeg(value) + delta) % 360;
  return normalizeRotationDeg(next < 0 ? next + 360 : next);
}

export function normalizeFocalPoint(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * 写真を回したとき、焦点も一緒に回す（2026-08-06 オーナー決定）。
 *
 * 焦点は「回転後の画像」に対する割合なので、回転させたまま据え置くと、
 * 一度合わせた被写体が枠から外れる。時計回り90度なら、元の左上は右上へ動く。
 */
export function rotateFocalPoint(
  focalX: unknown,
  focalY: unknown,
  delta: number,
): { focalX: number; focalY: number } {
  const x = normalizeFocalPoint(focalX);
  const y = normalizeFocalPoint(focalY);
  switch (rotateRotationDeg(0, delta)) {
    case 90:
      return { focalX: 100 - y, focalY: x };
    case 180:
      return { focalX: 100 - x, focalY: 100 - y };
    case 270:
      return { focalX: y, focalY: 100 - x };
    default:
      return { focalX: x, focalY: y };
  }
}

export function objectPositionFromFocal(
  focalX: unknown,
  focalY: unknown,
): string {
  return `${normalizeFocalPoint(focalX)}% ${normalizeFocalPoint(focalY)}%`;
}

export function parseRotationDeg(value: unknown): RotationDeg | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && ROTATIONS.has(n) ? (n as RotationDeg) : null;
}

export function imageUrlWithParams(
  url: string,
  {
    w,
    h,
    q,
    fmt,
    rotationDeg,
  }: {
    w?: number | null;
    h?: number | null;
    q?: number | null;
    fmt?: ImageFormat;
    rotationDeg?: unknown;
  } = {},
): string {
  const params: string[] = [];
  if (typeof w === "number") params.push(`w=${w}`);
  if (typeof h === "number") params.push(`h=${h}`);
  if (typeof q === "number") params.push(`q=${q}`);
  if (fmt) params.push(`fmt=${fmt}`);
  const rot = normalizeRotationDeg(rotationDeg);
  if (rot !== 0) params.push(`rot=${rot}`);
  if (params.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
}

export function orientedDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
  rotationDeg?: unknown,
): { width: number | null; height: number | null } {
  if (!width || !height) return { width: width ?? null, height: height ?? null };
  const rot = normalizeRotationDeg(rotationDeg);
  return rot === 90 || rot === 270
    ? { width: height, height: width }
    : { width, height };
}

export function orientedAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
  rotationDeg?: unknown,
): string | undefined {
  const dims = orientedDimensions(width, height, rotationDeg);
  return dims.width && dims.height ? `${dims.width} / ${dims.height}` : undefined;
}
