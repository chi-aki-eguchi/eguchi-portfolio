import { normalizePhotoDate } from "../../shared/photo-dates";
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

export function shotAtWithSourceForUploadedPhoto(
  exifShotAt: unknown,
  exifDateDigitized: unknown,
  file: Pick<File, "lastModified">,
  uploadMedium: UploadMedium,
  now = Date.now(),
): UploadedPhotoShotAt {
  // A camera scan's DateTimeOriginal is the scan time, not the film exposure.
  // Keep its provenance and name it accordingly in Admin. Never substitute now.
  const original = normalizePhotoDate(exifShotAt);
  const digitized = normalizePhotoDate(exifDateDigitized);
  if (original) return { shotAt: original, shotAtSource: "exif_original" };
  if (digitized) return { shotAt: digitized, shotAtSource: "exif_digitized" };
  void file; void uploadMedium; void now;
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
