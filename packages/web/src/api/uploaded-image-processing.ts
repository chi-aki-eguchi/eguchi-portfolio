import sharp from "sharp";

export const UNREADABLE_IMAGE_MESSAGE =
  "画像ファイルを読み取れませんでした。別の画像を選び直してください。";

export class UnreadableImageError extends Error {
  constructor(options?: ErrorOptions) {
    super(UNREADABLE_IMAGE_MESSAGE, options);
    this.name = "UnreadableImageError";
  }
}

export async function optimiseUploadedImage(
  input: Buffer | Uint8Array,
  maxPx: number,
  quality: number,
): Promise<Buffer> {
  try {
    return await sharp(Buffer.from(input))
      .rotate()
      .resize({
        width: maxPx,
        height: maxPx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
  } catch (error) {
    throw new UnreadableImageError({ cause: error });
  }
}
