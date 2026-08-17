/**
 * 分類を削除したときに「未分類」になる写真が何枚あるか。
 *
 * API 側の削除は、その分類が付いた写真の `category` を空にしてから分類を消す
 * （`api/index.ts` の categories DELETE）。**孤児を作らないための意図した設計**で、
 * バグではない。足りないのは、押す前にそれが分かることだった。確認は
 * 「『風景』を削除しますか？」だけで、何枚巻き込まれるかも、戻せないことも
 * 書いていなかった。
 *
 * **数えるのに新しい通信はしない。** Categories タブは写真を読んでいないので、
 * ここで全件を取りに行くと、いま一瞬で開くタブが待つようになる。代わりに
 * 画面が既に持っている一覧（TanStack Query のキャッシュ）から数える。
 *
 * **ゴミ箱の中も巻き込まれる。** 削除SQLは `deletedAt` で絞っていない。一方
 * 公開/管理の写真一覧はゴミ箱を含まないので、一覧だけで数えると足りない。
 * だから両方が揃っているときだけ数を出し、片方でも欠けていたら `null` を返す。
 * **半端な数を自信ありげに見せない**（「元に戻せません」と並ぶ数字なので）。
 */
export type CategorizedPhoto = { category?: string | null };

export function countPhotosInCategory(
  slug: string,
  live: readonly CategorizedPhoto[] | null | undefined,
  trashed: readonly CategorizedPhoto[] | null | undefined,
): number | null {
  if (!slug) return null;
  if (!live || !trashed) return null;
  const hit = (p: CategorizedPhoto) => (p.category ?? "") === slug;
  return live.filter(hit).length + trashed.filter(hit).length;
}
