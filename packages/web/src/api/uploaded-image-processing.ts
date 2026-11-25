import sharp from "sharp";

export const UNREADABLE_IMAGE_MESSAGE =
  "画像ファイルを読み取れませんでした。別の画像を選び直してください。";

export class UnreadableImageError extends Error {
  constructor(options?: ErrorOptions) {
    super(UNREADABLE_IMAGE_MESSAGE, options);
    this.name = "UnreadableImageError";
  }
}

/**
 * `input` が文字列なら一時ファイルの道順。ファイルから順に読むと、元の画像を
 * メモリに置かずに済む（出力は Buffer から読んだときと1バイトも変わらない）。
 */
export async function optimiseUploadedImage(
  input: Buffer | Uint8Array | string,
  maxPx: number,
  quality: number,
): Promise<Buffer> {
  try {
    const source =
      typeof input === "string"
        ? sharp(input, { sequentialRead: true })
        : sharp(Buffer.from(input));
    return await source
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
