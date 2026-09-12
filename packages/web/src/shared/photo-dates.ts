/** Camera wall-clock time: keep the date on the camera, without timezone shifts. */
export function normalizePhotoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .match(
      /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    );
  if (!match) return null;
  const [, y, m, d, h, min, s] = match;
  const date = `${y}-${m}-${d}T${h}:${min}:${s}`;
  const parsed = new Date(`${date}Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 19) === date
    ? date
    : null;
}

export type PhotoDates = { original: string | null; digitized: string | null };

/** Reads the original container, including TIFF IFDs and XMP. No image decoding. */
export async function readPhotoDates(
  input: Blob | Uint8Array,
): Promise<PhotoDates> {
  const { parse } = await import("exifr");
  const tags = await parse(input, {
    xmp: true,
    gps: false,
    interop: false,
    makerNote: false,
    userComment: false,
    ifd1: false,
    icc: false,
    iptc: false,
    reviveValues: false,
  });
  return {
    original: normalizePhotoDate(tags?.DateTimeOriginal),
    digitized: normalizePhotoDate(
      tags?.DateTimeDigitized ?? tags?.CreateDate ?? tags?.DateTimeCreated,
    ),
  };
}

/** Missing/invalid capture dates stay last in both directions, never use upload time. */
export function comparePhotoDates(
  a: unknown,
  b: unknown,
  direction: "asc" | "desc",
) {
  const time = (v: unknown) =>
    typeof v === "string" && v.trim() && Number.isFinite(Date.parse(v))
      ? Date.parse(v)
      : null;
  const A = time(a),
    B = time(b);
  if (A === null || B === null) return Number(A === null) - Number(B === null);
  return direction === "desc" ? B - A : A - B;
}
