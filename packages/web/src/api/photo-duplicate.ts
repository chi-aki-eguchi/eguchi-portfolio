import type { photos } from "./database/schema";

type PhotoRow = typeof photos.$inferSelect;
type PhotoInsert = typeof photos.$inferInsert;

/**
 * 複製で**新しく決まる**列。写真の情報ではなく、新しい行そのものの属性。
 *
 * - `id`: DBが採番する。
 * - `sortOrder`: 呼び出し側がライブラリの末尾を渡す。
 * - `deletedAt`: 複製はゴミ箱にない写真からしか作らないので、常に未削除。
 * - `createdAt`: 複製した時刻。「追加日」の並びでは新しい行として扱う。
 */
export type DuplicateFreshColumn = "id" | "sortOrder" | "deletedAt" | "createdAt";

type CopiedColumn = Exclude<keyof PhotoRow, DuplicateFreshColumn>;

/**
 * 複製で引き継ぐ値。**写真の列をすべて名指しする。**
 *
 * 戻り値の型が `DuplicateFreshColumn` 以外の全列を要求するため、写真に列を
 * 足したときは、ここで引き継ぐか新しく決めるかを選ぶまで型検査が通らない。
 * 以前は列を1つずつ手で並べていて、撮影日時の出どころや元ファイルの情報が
 * 黙って落ちていた（複製した写真だけ日時なしとして並びの末尾へ回った）。
 */
export function duplicatedPhotoValues(orig: PhotoRow): {
  [K in CopiedColumn]: PhotoInsert[K];
} {
  return {
    // 画像そのもの。ストレージの実体は複製せず、同じキーを参照する
    // （完全削除は、同じ url を参照する行が残っていれば実体を消さない）。
    filename: orig.filename,
    url: orig.url,
    fileHash: orig.fileHash,
    thumbKey: orig.thumbKey,
    mediumKey: orig.mediumKey,
    width: orig.width,
    height: orig.height,

    // 見せ方と所属。
    title: orig.title,
    description: orig.description,
    meta: orig.meta,
    category: orig.category,
    displaySize: orig.displaySize,
    isPublished: orig.isPublished,
    seriesId: orig.seriesId,
    rotationDeg: orig.rotationDeg,
    focalX: orig.focalX,
    focalY: orig.focalY,

    // 撮影機材。
    camera: orig.camera,
    lens: orig.lens,
    focalLength: orig.focalLength,
    fNumber: orig.fNumber,
    exposureTime: orig.exposureTime,
    iso: orig.iso,
    filmType: orig.filmType,
    cameraMake: orig.cameraMake,
    cameraModel: orig.cameraModel,

    // 撮影日時と、その出どころ。推測で埋めず、元の値をそのまま写す。
    // フィルムの撮影日（shotAt）と複写・デジタル化の日時（shotAtDigitized）は
    // 別の列のまま保つ。
    shotAt: orig.shotAt,
    shotAtDigitized: orig.shotAtDigitized,
    // `legacy` はアプリから書かない値（schema.ts）。元が legacy のときは列を
    // 渡さず、DBの既定値で同じ legacy にする。
    shotAtSource:
      orig.shotAtSource === "legacy" ? undefined : orig.shotAtSource,

    // 元ファイルの寸法と形式（保存した3200pxのJPEGとは別の値）。
    sourceWidth: orig.sourceWidth,
    sourceHeight: orig.sourceHeight,
    sourceFormat: orig.sourceFormat,
  };
}
