/**
 * 作業台（写真集の管理画面）で、作品の中の写真の順番を変える計算。
 *
 * サイトの順番は全写真で1本（`sortOrder`、保存は /admin/photos/reorder に
 * 全体の並びを渡す）。作品ごとの順番はその部分列なので、**その作品の写真が
 * いま占めている位置はそのままに、中身だけを並べ替える**。ほかの作品や
 * 未整理の写真の位置は1つも動かない。
 */

/** 配列の from 番目を to 番目へ動かした新しい配列。範囲外は元のまま。 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  if (from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * 全体の並び `globalIds` のうち、`workOrder` に入っている写真の位置へ、
 * `workOrder` の順で入れ直す。
 */
export function applyWorkOrder(globalIds: number[], workOrder: number[]): number[] {
  const inWork = new Set(workOrder);
  const queue = [...workOrder];
  return globalIds.map((id) => (inWork.has(id) ? queue.shift()! : id));
}

/** 作品の中で from → to に動かしたときの、新しい全体の並び。 */
export function moveWithinWork(
  globalIds: number[],
  workIds: number[],
  from: number,
  to: number,
): number[] {
  return applyWorkOrder(globalIds, moveItem(workIds, from, to));
}
