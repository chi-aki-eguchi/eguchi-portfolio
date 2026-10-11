/**
 * 新しい構成（siteDesign = "develop"）のページに出す写真を「選んで、並べる」画面の計算。
 *
 * 画面は写真アプリと同じ考え方（2026-10-10 オーナー「番号だと使いづらい。今どこにいるのか
 * わからない。スライドバーとか、サムネイルを小さくできる、apple の写真アプリみたいな
 * 使い心地がいい」）：番号は出さない。つまみで写真の大きさを変えて見渡す、つかんで動かす、
 * 押して選んでまとめて動かす、いま見ている月を出す。
 * ここには画面に依らない計算だけを置く（並べ替え・大きさ・月ごとの区切り・絞り込み）。
 */

export type PagePhoto = {
  id: number;
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  shotAt?: string | null;
  category?: string | null;
  filmType?: string | null;
  seriesId?: number | null;
  seriesIds?: number[] | null;
};

// ── 写真の大きさ：つまみの値（0〜100）と、1枚の幅（px） ──────────────
export const TILE_MIN = 44;
export const TILE_MAX = 260;
const clampZoom = (v: number) => Math.max(0, Math.min(100, v));

/** つまみの値 → 1枚の幅。等比で増える（どの位置でも同じ割合で大きくなる）。 */
export function tileFromZoom(zoom: number): number {
  return Math.round(TILE_MIN * Math.pow(TILE_MAX / TILE_MIN, clampZoom(zoom) / 100));
}

/** 1枚の幅 → つまみの値（つまんで大きさを変えたときに使う）。 */
export function zoomFromTile(tile: number): number {
  const t = Math.max(TILE_MIN, Math.min(TILE_MAX, tile));
  return clampZoom(Math.round((Math.log(t / TILE_MIN) / Math.log(TILE_MAX / TILE_MIN)) * 100));
}

/** 写真の間の余白。小さい写真ほど詰める。 */
export function gapForTile(tile: number): number {
  return tile < 70 ? 2 : tile < 110 ? 4 : tile < 170 ? 8 : 12;
}

/** その幅に、その大きさで何列入るか（CSS の auto-fill と同じ数え方）。 */
export function columnsFor(width: number, zoom: number): number {
  const tile = tileFromZoom(zoom);
  const gap = gapForTile(tile);
  return Math.max(1, Math.floor((width + gap) / (tile + gap)));
}

/** その幅に、ちょうど columns 列で入るいちばん大きいつまみの値（スマホの最初の大きさ＝3列）。 */
export function zoomForColumns(width: number, columns: number): number {
  for (let v = 70; v > 0; v--) if (columnsFor(width, v) >= columns) return v;
  return 0;
}

/** これより小さくしたら、足す画面の区切りを月から年にする（見出しが減って全体が見える）。 */
export const COARSE_TILE = 80;

// ── 並べ替え ────────────────────────────────────────────
export type MoveHow = "first" | "last" | "prev" | "next";

/** 選んだ写真をひとまとめにして、先頭・最後・1つ前・1つ後ろへ入れる。 */
export function moveGroup(order: readonly number[], moving: readonly number[], how: MoveHow): number[] {
  const set = new Set(moving);
  const picked = order.filter((id) => set.has(id));
  if (picked.length === 0) return [...order];
  const rest = order.filter((id) => !set.has(id));
  const here = order.slice(0, order.indexOf(picked[0]!)).filter((id) => !set.has(id)).length;
  const at =
    how === "first" ? 0 : how === "last" ? rest.length : Math.max(0, Math.min(rest.length, here + (how === "prev" ? -1 : 1)));
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}

/**
 * つかんだ写真を、いまの並びの index 番目の手前へ入れる（index は 0〜order.length）。
 * つかんだ写真が選んだ物の1つなら、選んだ物をまとめて動かす（呼ぶ側が moving に入れる）。
 */
export function dropAt(order: readonly number[], moving: readonly number[], index: number): number[] {
  const set = new Set(moving);
  const picked = order.filter((id) => set.has(id));
  if (picked.length === 0) return [...order];
  const rest = order.filter((id) => !set.has(id));
  const at = order.slice(0, Math.max(0, Math.min(order.length, index))).filter((id) => !set.has(id)).length;
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}

export const sameOrder = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

// ── 足す画面：撮った月ごとの区切りと絞り込み ─────────────────────
export type PickerFilter = "all" | "unused" | "picked" | "people" | "film";

/** "2025-08-14T…" → "2025-08"。撮影日が無ければ ""。 */
export const monthKey = (shotAt: string | null | undefined): string =>
  /^\d{4}-\d{2}/.test(shotAt ?? "") ? (shotAt as string).slice(0, 7) : "";

/** 区切りの見出し。"2025-08" → 「2025年 8月」、"2025" → 「2025年」、"" → 「撮影日なし」。 */
export function periodLabel(key: string): string {
  if (!key) return "撮影日なし";
  return key.length === 4 ? `${key}年` : `${key.slice(0, 4)}年 ${Number(key.slice(5, 7))}月`;
}

const inSeries = (photo: PagePhoto, id: number) =>
  photo.seriesId === id || (photo.seriesIds ?? []).includes(id);
const hasSeries = (photo: PagePhoto) => photo.seriesId != null || (photo.seriesIds ?? []).length > 0;

/**
 * 足す画面に出す写真。
 * - unused: まだどのページにも出していない写真（used に入っていない）
 * - picked: いま選んでいる写真（選んだ順のまま）
 * - people: 分類が portrait の写真 ／ film: フィルムの写真
 * - series: "none" はシリーズに入れていない写真、数字はそのシリーズの写真
 */
export function filterPhotos(
  photos: readonly PagePhoto[],
  options: { filter: PickerFilter; series: number | "none" | null; used: ReadonlySet<number>; draft: readonly number[] },
): PagePhoto[] {
  const { filter, series, used, draft } = options;
  const bySeries = (p: PagePhoto) => series === null || (series === "none" ? !hasSeries(p) : inSeries(p, series));
  if (filter === "picked") {
    const byId = new Map(photos.map((p) => [p.id, p]));
    return draft.map((id) => byId.get(id)).filter((p): p is PagePhoto => Boolean(p) && bySeries(p as PagePhoto));
  }
  return photos.filter(
    (p) =>
      bySeries(p) &&
      (filter === "all" ||
        (filter === "unused" && !used.has(p.id)) ||
        (filter === "people" && (p.category ?? "").trim() === "portrait") ||
        (filter === "film" && p.filmType === "フィルム")),
  );
}

export type PhotoGroup = { key: string; label: string; photos: PagePhoto[] };

/**
 * 撮った月ごと（coarse なら年ごと）に区切る。新しい月が上、撮影日の無い写真は最後。
 * 同じ月の中は、渡された順のまま。
 */
export function groupByPeriod(photos: readonly PagePhoto[], coarse: boolean): PhotoGroup[] {
  const groups = new Map<string, PagePhoto[]>();
  for (const photo of photos) {
    const month = monthKey(photo.shotAt);
    const key = coarse ? month.slice(0, 4) : month;
    const list = groups.get(key);
    if (list) list.push(photo);
    else groups.set(key, [photo]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a === "" ? 1 : b === "" ? -1 : a < b ? 1 : -1))
    .map(([key, list]) => ({ key, label: periodLabel(key), photos: list }));
}
