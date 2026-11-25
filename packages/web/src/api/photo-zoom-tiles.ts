import { mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  ZOOM_MAX_PX,
  ZOOM_TILE_EXT,
  ZOOM_TILE_PX,
  zoomLevels,
  zoomTilePath,
  type ZoomSize,
} from "../shared/photo-zoom";

/** 四角1枚の画質。細部を見るためのものなので、表示用（85前後）より上げてある。 */
export const ZOOM_TILE_QUALITY = 90;

export type BuiltZoomTiles = {
  size: ZoomSize;
  /** `path` は一時ファイル、`rel` は基点からの置き場所（"0/3_2.webp"）。 */
  tiles: { rel: string; path: string }[];
  cleanup: () => Promise<void>;
};

/**
 * 元のファイルから、拡大用の高精細（四角に切ったもの）を一時フォルダへ作る。
 *
 * 元の長辺が `minSourcePx` 以下なら作らない（保存する1枚で足りる）。
 * 帯ごとに読んで書き出すので、メモリは元の大きさにほとんど依らない
 * （1億画素の JPEG から 8K で約190MB。手元の実測、2026-11-25）。
 * 色の扱いは保存する1枚と同じ（sharp の既定で sRGB へ変換し、付帯情報は落とす）。
 */
export async function buildZoomTiles(
  sourcePath: string,
  options: { minSourcePx: number; maxPx?: number; dir?: string },
): Promise<BuiltZoomTiles | null> {
  const meta = await sharp(sourcePath).metadata();
  const sourceLong = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (sourceLong <= options.minSourcePx) return null;

  const maxPx = options.maxPx ?? ZOOM_MAX_PX;
  const root = join(options.dir ?? join(tmpdir(), "portfolio-uploads"), `zoom-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  const cleanup = () => rm(root, { recursive: true, force: true });
  try {
    const info = await sharp(sourcePath, { sequentialRead: true })
      .rotate()
      .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
      .webp({ quality: ZOOM_TILE_QUALITY })
      .tile({ size: ZOOM_TILE_PX, overlap: 0, layout: "dz" })
      .toFile(join(root, "z.dz"));
    const size = { w: info.width, h: info.height };

    // libvips は 1px まで全部の段を作る。段の番号は粗い方から 0 なので、数えて逆に引く。
    const filesDir = join(root, "z_files");
    const dzLevels = (await readdir(filesDir)).filter((name) => /^\d+$/.test(name));
    const top = Math.max(...dzLevels.map(Number));
    const tiles: BuiltZoomTiles["tiles"] = [];
    for (const level of zoomLevels(size)) {
      const dir = join(filesDir, String(top - level.index));
      const present = new Set(await readdir(dir));
      for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
          const name = `${col}_${row}.${ZOOM_TILE_EXT}`;
          // 1枚でも欠けたまま公開すると、拡大した先に穴が開く。
          if (!present.has(name))
            throw new Error(`zoom tile missing: level ${level.index} ${name}`);
          tiles.push({
            rel: zoomTilePath(level.index, col, row),
            path: join(dir, name),
          });
        }
      }
    }
    return { size, tiles, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** `limit` 本ずつ並べて実行する。1本でも失敗したら、残りは始めずに投げる。 */
export async function runPooled<T>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try {
        await run(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  const rejected = results.find((r) => r.status === "rejected");
  if (rejected) throw (rejected as PromiseRejectedResult).reason;
}
