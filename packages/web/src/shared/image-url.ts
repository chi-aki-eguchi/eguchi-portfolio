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
    q,
    fmt,
    rotationDeg,
  }: {
    w?: number | null;
    q?: number | null;
    fmt?: ImageFormat;
    rotationDeg?: unknown;
  } = {},
): string {
  const params: string[] = [];
  if (typeof w === "number") params.push(`w=${w}`);
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
