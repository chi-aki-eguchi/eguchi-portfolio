type UploadMedium = "digital" | "film";

export type ShotAtSource =
  | "exif_original"
  | "exif_digitized"
  | "file_modified"
  | "none"
  | "manual";

export type UploadedPhotoShotAt = {
  shotAt: string;
  shotAtSource: ShotAtSource;
};

function toShotAt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function shotAtWithSourceForUploadedPhoto(
  exifShotAt: unknown,
  exifDateDigitized: unknown,
  file: Pick<File, "lastModified">,
  uploadMedium: UploadMedium,
  now = Date.now(),
): UploadedPhotoShotAt {
  if (uploadMedium === "film") {
    // Film: a scanner/lab has no way to know the original shot date, so
    // DateTimeOriginal (and the Image.DateTime fallback folded into
    // exifShotAt server-side) is untrustworthy here — it's often just the
    // scan/export timestamp mislabeled as capture time. DateTimeDigitized is
    // the EXIF-spec-correct tag for "when this became a digital file", so
    // it's the only EXIF signal trusted for film. Falls back to the file's
    // own modified date — still a real digitization-time fact, not a guess.
    if (typeof exifDateDigitized === "string" && exifDateDigitized.trim()) {
      return {
        shotAt: exifDateDigitized.trim(),
        shotAtSource: "exif_digitized",
      };
    }
    // Browsers almost always provide File.lastModified, so the `now` fallback
    // below is not expected in normal uploads. Keep it to preserve the existing
    // timestamp behavior, and classify that fallback as file_modified too.
    const fileModified =
      typeof file.lastModified === "number" &&
      Number.isFinite(file.lastModified) &&
      file.lastModified > 0
        ? file.lastModified
        : now;
    return {
      shotAt: toShotAt(fileModified),
      shotAtSource: "file_modified",
    };
  }

  // Digital: camera-written DateTimeOriginal (or Image.DateTime fallback) is trustworthy.
  if (typeof exifShotAt === "string" && exifShotAt.trim()) {
    return {
      shotAt: exifShotAt.trim(),
      shotAtSource: "exif_original",
    };
  }
  return { shotAt: "", shotAtSource: "none" };
}

export function shotAtForUploadedPhoto(
  exifShotAt: unknown,
  exifDateDigitized: unknown,
  file: Pick<File, "lastModified">,
  uploadMedium: UploadMedium,
  now = Date.now(),
): string {
  return shotAtWithSourceForUploadedPhoto(
    exifShotAt,
    exifDateDigitized,
    file,
    uploadMedium,
    now,
  ).shotAt;
}

export function shotAtForDateInputSave(
  currentShotAt: string | null | undefined,
  dateInputValue: string,
): string {
  return dateInputValue === (currentShotAt || "").slice(0, 10)
    ? currentShotAt || ""
    : dateInputValue;
}
