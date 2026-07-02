const UPLOAD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/x-tiff",
  "image/avif",
]);

const UPLOAD_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "tif",
  "tiff",
  "avif",
]);

export const UPLOAD_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.tif,.tiff,image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/tiff,image/x-tiff";

export function isUploadableImageFile(file: {
  name?: string;
  type?: string;
}): boolean {
  const type = file.type?.toLowerCase() ?? "";
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  if (type && UPLOAD_IMAGE_TYPES.has(type)) return true;
  if (!UPLOAD_IMAGE_EXTENSIONS.has(ext)) return false;
  return !type || type === "application/octet-stream" || type === "image/tiff" || type === "image/x-tiff";
}

export function uploadFailureNotice(
  failures: { file: Pick<File, "name">; reason?: string }[],
): string | null {
  if (!failures.length) return null;
  const names = failures
    .slice(0, 3)
    .map(({ file, reason }) => `${file.name}${reason ? ` (${reason})` : ""}`)
    .join(", ");
  return `${failures.length} 件失敗: ${names}${failures.length > 3 ? " ほか" : ""}`;
}
