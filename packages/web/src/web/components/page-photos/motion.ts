/**
 * 並びや大きさが変わるとき、写真を作り直さずに「元の場所 → 新しい場所」へ滑らせる（FLIP）。
 *
 * 管理画面の試作を実機の iPhone で触ったオーナーの指摘（2026-10-10「かくってなったり
 * チラッてなる」）の直し方をそのまま持ってきた：写真を作り直すと一瞬消えて出直し、
 * 場所だけ一度に変えると飛んで見える。先に今の場所を測り（measureFlip）、並べ直した後に
 * 元の場所から新しい場所へ動かす（playFlip）。
 * 目印は `data-flip`。画面の外の写真は動かさない。多すぎるとき・動きを減らす設定では何もしない。
 */
export type Rects = Map<string, DOMRect>;

const NEAR = 300;
const MAX_ELEMENTS = 700;
const FLIP_ID = "pp-flip";

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > -NEAR && r.top < window.innerHeight + NEAR;

export function measureFlip(root: HTMLElement): Rects {
  const rects: Rects = new Map();
  for (const el of root.querySelectorAll<HTMLElement>("[data-flip]")) {
    const r = el.getBoundingClientRect();
    if (onScreen(r)) rects.set(el.dataset.flip!, r);
  }
  return rects;
}

/** from: その目印だけ、測った場所の代わりに使う出発点（つかんで離した写真は、離した場所から）。 */
export function playFlip(root: HTMLElement, first: Rects, ms: number, from?: Rects): void {
  if (reducedMotion()) return;
  const els = [...root.querySelectorAll<HTMLElement>("[data-flip]")];
  if (els.length > MAX_ELEMENTS) return;
  // 前の動きの途中なら止めてから測る（途中の場所を「新しい場所」と読まない）。
  for (const el of els) for (const a of el.getAnimations()) if (a.id === FLIP_ID) a.cancel();
  const last = els.map((el) => [el, el.getBoundingClientRect()] as const);
  for (const [el, b] of last) {
    if (!onScreen(b)) continue;
    const key = el.dataset.flip!;
    const a = from?.get(key) ?? first.get(key);
    let animation: Animation;
    if (!a) {
      animation = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: "ease" });
    } else {
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const sx = a.width / b.width;
      const sy = a.height / b.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01) continue;
      animation = el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: ms, easing: "cubic-bezier(.2,.7,.1,1)" },
      );
    }
    animation.id = FLIP_ID;
  }
}
