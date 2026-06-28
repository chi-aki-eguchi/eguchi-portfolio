type UploadMedium = "digital" | "film";

function toShotAt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function shotAtForUploadedPhoto(
  exifShotAt: unknown,
  file: Pick<File, "lastModified">,
  uploadMedium: UploadMedium,
  now = Date.now(),
): string {
  if (typeof exifShotAt === "string" && exifShotAt.trim()) {
    return exifShotAt.trim();
  }

  if (uploadMedium !== "film") return "";

  const fileModified =
    typeof file.lastModified === "number" &&
    Number.isFinite(file.lastModified) &&
    file.lastModified > 0
      ? file.lastModified
      : now;

  return toShotAt(fileModified);
}
