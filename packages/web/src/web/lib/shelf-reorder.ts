/**
 * 棚の中だけで1つ動かして、**全体の並びを返す**。
 *
 * サーバの並べ替えは全件を1つの並びとして受け取り、`expectedIds` が現在の
 * 全件と一致しないと拒否する。棚で絞った id だけを送ると、もう片方の棚の行が
 * 並びから消える＝その棚の順番が壊れる（2026-08-30、Work の棚を足したときに
 * 一度そう書いていた）。
 *
 * だから「見えている棚の中で入れ替え、その結果を**元の位置へ書き戻す**」。
 * もう片方の棚の行は、全体の中の位置を1つも動かさない。
 */
export type ShelfRow = { id: number; kind?: string | null };

/** 空・未知の値は既定の棚（`series`）として読む。列を足す前の行のため。 */
export function shelfOf(row: ShelfRow): "series" | "work" {
  return row.kind === "work" ? "work" : "series";
}

/** 動かせないとき（端・見つからない）は `null`。呼び出し側は何もしない。 */
export function reorderWithinShelf(
  rows: ShelfRow[],
  id: number,
  delta: number,
  shelf: "series" | "work",
): number[] | null {
  const full = rows.map((r) => r.id);
  const slots = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => shelfOf(r) === shelf)
    .map(({ i }) => i);
  const shelfIds = slots.map((i) => full[i]!);
  const idx = shelfIds.indexOf(id);
  const to = idx + delta;
  if (idx < 0 || to < 0 || to >= shelfIds.length) return null;
  shelfIds.splice(idx, 1);
  shelfIds.splice(to, 0, id);
  const next = [...full];
  slots.forEach((slot, n) => {
    next[slot] = shelfIds[n]!;
  });
  return next;
}
