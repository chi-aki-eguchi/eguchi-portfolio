/**
 * 写真1枚にあてる最小の幅。
 *
 * 実際の列数は「表示できる幅 ÷ この値」で決まり、**最大列数はその上限に
 * すぎない**。つまり画面が狭ければ、最大列数を上げても列は増えない。
 *
 * この数値が1か所に無かったため、管理画面は「なぜ列数が伸びないのか」を
 * 説明できなかった。オーナーは設定プレビュー（幅320〜780px）でマソンリーを
 * 見て「3列固定」と判断していた。実際は floor(780 ÷ 210) = 3 で、どの配置
 * でも同じ結果になる幅だった（2026-08-09 実測）。
 *
 * 公開サイト（PhotoGallery）と管理画面の説明が同じ数値を読むために、
 * ここを唯一の置き場所とする。片方だけ変えない。
 */
export const GALLERY_MIN_TILE_DESKTOP = 210;
export const GALLERY_MIN_TILE_MOBILE = 150;

/** その幅で実際に並べられる列数（最大列数で頭打ち）。 */
export function columnsThatFit({
  width,
  sizeScale,
  maxColumns,
  isMobile,
}: {
  width: number;
  sizeScale: number;
  maxColumns: number;
  isMobile: boolean;
}): number {
  const minTile =
    (isMobile ? GALLERY_MIN_TILE_MOBILE : GALLERY_MIN_TILE_DESKTOP) * sizeScale;
  if (!(width > 0) || !(minTile > 0)) return 1;
  return Math.max(1, Math.min(maxColumns, Math.floor(width / minTile) || 1));
}
