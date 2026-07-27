export type SourceFormat =
  | "jpeg"
  | "png"
  | "webp"
  | "tiff"
  | "avif"
  | "heic"
  | "other"
  | null;

export type UploadSourceMetadata = {
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceFormat: SourceFormat;
};

export type WritableShotAtSource =
  | "exif_original"
  | "exif_digitized"
  | "file_modified"
  | "manual"
  | "none";

const WRITABLE_SHOT_AT_SOURCES = new Set<WritableShotAtSource>([
  "exif_original",
  "exif_digitized",
  "file_modified",
  "manual",
  "none",
]);

const WRITABLE_SOURCE_FORMATS = new Set<Exclude<SourceFormat, null>>([
  "jpeg",
  "png",
  "webp",
  "tiff",
  "avif",
  "heic",
  "other",
]);

export function normalizeSourceFormat(
  format: unknown,
  compression: unknown,
): SourceFormat {
  if (typeof format !== "string" || !format) return null;
  if (
    format === "jpeg" ||
    format === "png" ||
    format === "webp" ||
    format === "tiff"
  )
    return format;
  if (format === "heif" && compression === "av1") return "avif";
  if (format === "heif" && compression === "hevc") return "heic";
  return "other";
}

export function sourceMetadataFromSharpMetadata(
  metadata: unknown,
): UploadSourceMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {
      sourceWidth: null,
      sourceHeight: null,
      sourceFormat: null,
    };
  }

  const values = metadata as {
    format?: unknown;
    compression?: unknown;
    autoOrient?: { width?: unknown; height?: unknown };
  };
  const autoOrient = values.autoOrient;

  return {
    // The saved width/height describe the rotated 3200px JPEG. These source
    // dimensions must use the same displayed orientation, not raw metadata
    // width/height, so the two pairs differ only in scale.
    sourceWidth:
      typeof autoOrient?.width === "number" &&
      Number.isFinite(autoOrient.width)
        ? autoOrient.width
        : null,
    sourceHeight:
      typeof autoOrient?.height === "number" &&
      Number.isFinite(autoOrient.height)
        ? autoOrient.height
        : null,
    sourceFormat: normalizeSourceFormat(values.format, values.compression),
  };
}

export function normalizeShotAtSourceForInsert(
  value: unknown,
): WritableShotAtSource {
  return typeof value === "string" &&
    WRITABLE_SHOT_AT_SOURCES.has(value as WritableShotAtSource)
    ? (value as WritableShotAtSource)
    : "none";
}

export function normalizeSourceFormatForInsert(
  value: unknown,
): SourceFormat {
  if (typeof value !== "string" || !value) return null;
  return WRITABLE_SOURCE_FORMATS.has(value as Exclude<SourceFormat, null>)
    ? (value as Exclude<SourceFormat, null>)
    : "other";
}
