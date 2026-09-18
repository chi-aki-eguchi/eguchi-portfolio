/**
 * 作り置きサムネを、実際に描く大きさに合わせて頼む。
 *
 * 一覧のタイルは、作り置きのサムネ（長辺640px）をそのまま `<img src>` に使う。
 * 1枚あたり1回の通信で済む代わりに、**タイルが小さいほど無駄が大きくなる。**
 *
 * 2026-09-19 実測（390px・DPR2 のスマホで本番トップを開いたとき、スクロール前）:
 * 40枚のうち38枚が 74px の枠に 640px の画像を受け取っていた（必要な 148px に対し
 * 4.32倍）。合計 2.22MB。同じ写真を w=160 で頼むと 140.8KB → 11.4KB だった。
 *
 * 頼む幅は段で刻む。種類が増えるほどサーバー側の縮小結果の控えが増えるので、
 * 1枚ごとの正確な幅ではなく、足りる中でいちばん小さい段を使う。
 */

/** 作り置きサムネの長辺。 */
export const GENERATED_THUMB_WIDTH = 640;

const STEPS = [160, 240, 320, 480] as const;

/**
 * その枠に必要な幅の段。縮めても意味が無い（元のサムネが妥当）なら null。
 *
 * null のときは呼び出し側が作り置きサムネをそのまま使う——**縮めるかどうか
 * 迷うくらいなら、今までどおり大きいほうを使う。** 写真が眠い方が、
 * 通信が増えるより悪い。
 */
export function fittedThumbWidth(
  cssWidth: number | null | undefined,
  devicePixelRatio: number | null | undefined,
): number | null {
  if (typeof cssWidth !== "number" || !Number.isFinite(cssWidth) || cssWidth <= 0)
    return null;
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
  const needed = cssWidth * dpr;
  const step = STEPS.find((width) => width >= needed);
  return step && step < GENERATED_THUMB_WIDTH ? step : null;
}
