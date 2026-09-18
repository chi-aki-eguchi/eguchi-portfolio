/**
 * トップ（Works）に手動で出す写真の並び。
 *
 * 設定 `topWorksIds` は「写真IDをカンマで並べた1つの文字列」で、**その並び順が
 * そのまま表示順**になる。写真一覧全体の並び順（`sortOrder`）とは別物で、
 * ここを触っても一覧の並びも写真の原本も変わらない。
 *
 * 読み方の規則をここ1か所に置く。公開側（top.tsx）と管理画面（TopWorksPicker）
 * が別々に文字列を解いていると、片方だけ重複や空白の扱いが変わる。
 */

/** "12, 7,12 ,x" → [12, 7]。重複は最初の1つを残す（表示順の意味を保つ）。 */
export function parseTopWorksIds(value: string | null | undefined): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of (value ?? "").split(",")) {
    const id = parseInt(part.trim(), 10);
    // 重複した ID は同じ写真を2度指す。PhotoGallery は写真IDを key にするので、
    // 重なるとタイルが1枚消える・出現の動きが壊れる（2026-07 に踏んだ）。
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function serializeTopWorksIds(ids: readonly number[]): string {
  return ids.join(",");
}

/** 選ぶ／外す。新しく選んだ写真は末尾に付く（＝最後に出る）。 */
export function toggleTopWorksId(
  ids: readonly number[],
  id: number,
): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** 1枚だけ前後へ動かす。範囲の外へは動かさない（端で押しても並びは変わらない）。 */
export function moveTopWorksId(
  ids: readonly number[],
  from: number,
  to: number,
): number[] {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to)
    return [...ids];
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
