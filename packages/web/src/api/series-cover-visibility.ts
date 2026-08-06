import { eq, inArray, isNull, sql, type SQL, type SQLWrapper } from "drizzle-orm";

type CoverPhotoColumns = {
  id: SQLWrapper;
  deletedAt: SQLWrapper;
  isPublished: SQLWrapper;
};

/**
 * 公開シリーズ一覧のカバー写真を引く条件。
 *
 * ここを緩めると、非公開のカバー写真とゴミ箱の写真が公開ページに出る
 * (2026-08-06 `45f4ad5`)。3条件のどれが欠けても
 * `series-cover-visibility.test.ts` が実DBで検出する。
 */
export function buildPublicCoverPhotoFilter(
  columns: CoverPhotoColumns,
  coverIds: readonly number[],
): SQL {
  return sql`${inArray(columns.id, [...coverIds])} AND ${isNull(columns.deletedAt)} AND ${eq(columns.isPublished, true)}`;
}
