/**
 * 拡大して見るための高精細（タイル）の約束ごと（2026-11-25）。
 *
 * 取り込みで保存する1枚は長辺3200pxで、4Kの画面いっぱいにも足りなかった。かといって
 * 8Kの1枚を作ると、サーバーのメモリが約660MB要り（1億画素から。手元の実測）、見る側も
 * 開くたびに十数MBを丸ごと読むことになる。
 *
 * そこで地図と同じく、高精細は 1024px の四角に切って置く。見えている所の四角だけを
 * 読むので、8Kでも開いた直後から速い。作るときも帯ごとに書き出すので、1億画素から
 * でも約190MBで済む（同じ実測）。
 *
 * 段は上（いちばん細かい）から 0, 1, … と半分ずつ。長辺が {@link ZOOM_MIN_LEVEL_PX}
 * 以下の段は置かない（画面に収めた表示用の1枚で足りる）。
 *
 * **サーバー（作る・消す）と画面（読む）の両方がここを使う。** 段の大きさや枚数を
 * 片方だけで数えると、無い四角を読みに行く。
 */
export const ZOOM_TILE_PX = 1024;
/** いちばん細かい段の長辺の上限。元がこれより小さければ元の大きさ。 */
export const ZOOM_MAX_PX = 7680;
/** これ以下の段は置かない。 */
export const ZOOM_MIN_LEVEL_PX = 2000;
export const ZOOM_TILE_EXT = "webp";
export const ZOOM_KEY_PREFIX = "tiles/";

export type ZoomSize = { w: number; h: number };
export type ZoomLevel = {
  index: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
};

/** DBの `zoom_size`（"7680x5760"）を読む。形が違えば null（＝高精細なし）。 */
export function parseZoomSize(raw: unknown): ZoomSize | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,5})x(\d{1,5})$/.exec(raw);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w < 1 || h < 1 || w > 65535 || h > 65535) return null;
  return { w, h };
}

export function formatZoomSize(size: ZoomSize): string {
  return `${size.w}x${size.h}`;
}

/** 置いてある段。細かい順。いちばん上の段は大きさに関係なく必ず含む。 */
export function zoomLevels(size: ZoomSize): ZoomLevel[] {
  const levels: ZoomLevel[] = [];
  let { w, h } = size;
  for (let index = 0; ; index++) {
    if (index > 0 && Math.max(w, h) <= ZOOM_MIN_LEVEL_PX) break;
    levels.push({
      index,
      w,
      h,
      cols: Math.ceil(w / ZOOM_TILE_PX),
      rows: Math.ceil(h / ZOOM_TILE_PX),
    });
    if (w === 1 && h === 1) break;
    // libvips の段の作り方（半分にして切り上げ）に合わせる。
    w = Math.ceil(w / 2);
    h = Math.ceil(h / 2);
  }
  return levels;
}

/** 基点からの相対の置き場所（"0/3_2.webp"）。 */
export function zoomTilePath(level: number, col: number, row: number): string {
  return `${level}/${col}_${row}.${ZOOM_TILE_EXT}`;
}

/** その写真の高精細をなす、すべての相対の置き場所。 */
export function zoomTilePaths(size: ZoomSize): string[] {
  const paths: string[] = [];
  for (const level of zoomLevels(size))
    for (let row = 0; row < level.rows; row++)
      for (let col = 0; col < level.cols; col++)
        paths.push(zoomTilePath(level.index, col, row));
  return paths;
}

/**
 * 保存する1枚の鍵（"photos/abc.jpg"）から、高精細の基点（"tiles/abc"）を決める。
 * 写真ごとに別の列を持たず、ここで一意に決まるようにしてある（thumbs/ medium/ と同じ）。
 */
export function zoomBaseKey(photoKey: string): string | null {
  if (!photoKey.startsWith("photos/")) return null;
  const stem = photoKey.replace(/^photos\//, "").replace(/\.[^.]+$/, "");
  if (!stem || stem.includes("/")) return null;
  return `${ZOOM_KEY_PREFIX}${stem}`;
}

/** 高精細の鍵（"tiles/abc/0/1_2.webp"）から、元の写真の語幹（"abc"）を取り出す。 */
export function zoomStemFromTileKey(tileKey: string): string | null {
  const m = /^tiles\/([^/]+)\/\d{1,2}\/\d{1,3}_\d{1,3}\.webp$/.exec(tileKey);
  return m ? m[1] : null;
}

/**
 * 画面に出ている幅（機器の画素数）に足りる、いちばん粗い段を選ぶ。
 * どの段でも足りなければ、いちばん細かい段。
 */
export function pickZoomLevel(
  levels: readonly ZoomLevel[],
  neededWidthPx: number,
): ZoomLevel | null {
  if (levels.length === 0) return null;
  for (let i = levels.length - 1; i >= 0; i--)
    if (levels[i].w >= neededWidthPx * 0.95) return levels[i];
  return levels[0];
}

export type ZoomTilePlacement = {
  level: number;
  col: number;
  row: number;
  /** 写真全体に対する割合（%）。 */
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * 写真のうち見えている範囲（0〜1 の割合）にかかる四角。
 * `margin` は範囲の外へ余分に読む四角の数（少し動かしたときの空白を減らす）。
 */
export function visibleZoomTiles(
  level: ZoomLevel,
  view: { x0: number; y0: number; x1: number; y1: number },
  margin = 0,
): ZoomTilePlacement[] {
  const x0 = Math.max(0, Math.min(1, view.x0));
  const y0 = Math.max(0, Math.min(1, view.y0));
  const x1 = Math.max(0, Math.min(1, view.x1));
  const y1 = Math.max(0, Math.min(1, view.y1));
  if (x1 <= x0 || y1 <= y0) return [];
  const colFrom = Math.max(0, Math.floor((x0 * level.w) / ZOOM_TILE_PX) - margin);
  const rowFrom = Math.max(0, Math.floor((y0 * level.h) / ZOOM_TILE_PX) - margin);
  const colTo = Math.min(
    level.cols - 1,
    Math.ceil((x1 * level.w) / ZOOM_TILE_PX) - 1 + margin,
  );
  const rowTo = Math.min(
    level.rows - 1,
    Math.ceil((y1 * level.h) / ZOOM_TILE_PX) - 1 + margin,
  );
  const tiles: ZoomTilePlacement[] = [];
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) {
      const px = col * ZOOM_TILE_PX;
      const py = row * ZOOM_TILE_PX;
      const tw = Math.min(ZOOM_TILE_PX, level.w - px);
      const th = Math.min(ZOOM_TILE_PX, level.h - py);
      tiles.push({
        level: level.index,
        col,
        row,
        left: (px / level.w) * 100,
        top: (py / level.h) * 100,
        width: (tw / level.w) * 100,
        height: (th / level.h) * 100,
      });
    }
  }
  return tiles;
}
