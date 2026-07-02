export const IMAGE_UPLOAD_MAX_BYTES = 300 * 1024 * 1024;
export const LARGE_IMAGE_UPLOAD_BYTES = 60 * 1024 * 1024;

export function formatUploadSizeLimit(bytes = IMAGE_UPLOAD_MAX_BYTES): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function imageTooLargeMessage(
  bytes = IMAGE_UPLOAD_MAX_BYTES,
): string {
  return `画像が大きすぎます（上限: ${formatUploadSizeLimit(bytes)}）。`;
}
