import { inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as libsqlSchema from "./database/schema";

// 型のみの参照。settings-write.ts と同じ制約で、DATABASE_URL 未設定でも
// このモジュール単体を読み込める。
type PhotosDb = LibSQLDatabase<typeof libsqlSchema>;
type PhotosTable = typeof libsqlSchema.photos;

export type BatchPhotoMetadataPatch = {
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
};

const metadataKeys = ["camera", "lens", "filmType"] as const;

export function buildBatchPhotoMetadataPatch(
  value: unknown,
): BatchPhotoMetadataPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const patch: BatchPhotoMetadataPatch = {};
  const values = value as Record<string, unknown>;
  for (const key of metadataKeys) {
    const field = values[key];
    if (field === undefined || field === "") continue;
    if (typeof field !== "string") return null;
    patch[key] = field.trim() ? field : null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * 選択中の写真すべてへ、1回の UPDATE でメタデータを反映する。
 *
 * 書き込みをここへ置くのは、`index.ts` に残すと配線をソース文字列でしか
 * 検査できず、`.set(patch)` を `.set({})` にしても素通りしたため
 * (2026-08-06 の追試 M3)。実DBで検査できる場所へ移した。
 */
export async function applyBatchPhotoMetadata(
  db: PhotosDb,
  photosTable: PhotosTable,
  ids: readonly number[],
  patch: BatchPhotoMetadataPatch,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(photosTable)
    .set(patch)
    .where(inArray(photosTable.id, [...ids]));
}
