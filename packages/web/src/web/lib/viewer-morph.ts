/**
 * ビューアの開閉を「頁の写真そのものが大きくなる／元の場所へ戻る」動きに
 * する部品（2026-09-25）。
 *
 * 押した写真の画像（もう読み込み済み）を複製した「影」を1枚だけ画面の最前面に
 * 置き、頁の上の位置からビューアの中の位置まで運ぶ。着いたらビューアの本物の
 * 写真と入れ替える。影の中の画像は object-fit: cover なので、一覧で切り抜いて
 * いた写真も、運ぶ間に切り抜きがほどけて全体が現れる。
 *
 * 動きを減らす設定のときは使わない（移動そのものなので）。呼ぶ側が判定する。
 */

export type Rect = { x: number; y: number; w: number; h: number };

/** 箱の中に、縦横比 `aspect`（幅/高さ）の写真を収めたときの位置（contain）。 */
export function containRect(box: Rect, aspect: number): Rect {
  if (!(aspect > 0) || box.w <= 0 || box.h <= 0) return box;
  const boxAspect = box.w / box.h;
  const w = boxAspect > aspect ? box.h * aspect : box.w;
  const h = boxAspect > aspect ? box.h : box.w / aspect;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** 画面の中に見えている割合（0〜1）。 */
export function visibleRatio(r: Rect): number {
  if (r.w <= 0 || r.h <= 0) return 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ix = Math.max(0, Math.min(r.x + r.w, vw) - Math.max(r.x, 0));
  const iy = Math.max(0, Math.min(r.y + r.h, vh) - Math.max(r.y, 0));
  return (ix * iy) / (r.w * r.h);
}

/** 画面の中に `min` の割合以上見えているか。 */
export function isMostlyInView(r: Rect, min = 0.5): boolean {
  return visibleRatio(r) >= min;
}

/**
 * 頁（ビューアの外）に出ている、その写真の画像。読み込み済みのものだけ。
 * 読み込み前の画像を運ぶと、空の枠が飛んでいくように見える。
 *
 * 同じ写真が1つの画面に2度出ることがある（作品の扉の写真と、その頁）。
 * いちばんよく見えているほうを選ぶ。どれも見えていなければ最初のもの
 * （閉じるときに、そこまで頁を送る）。
 */
export function sourceImageFor(photoId: number | undefined): HTMLImageElement | null {
  if (photoId == null || typeof document === "undefined") return null;
  const tiles = document.querySelectorAll<HTMLElement>(`[data-photo-tile="${photoId}"]`);
  let best: HTMLImageElement | null = null;
  let bestRatio = -1;
  for (const tile of tiles) {
    if (tile.closest("dialog")) continue;
    const img = tile.querySelector("img");
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    const ratio = visibleRatio(rectOf(img));
    if (ratio > bestRatio) {
      best = img;
      bestRatio = ratio;
    }
  }
  return best;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 開くとき: ゆっくり降りてきて、静かに止まる。 */
export const MORPH_OPEN_MS = 560;
/** 閉じるとき: 開くときより少し短く。見終えた人を待たせない。 */
export const MORPH_CLOSE_MS = 440;
export const MORPH_EASE = "cubic-bezier(0.22, 0.8, 0.16, 1)";
/**
 * 次の写真へ送るとき、前の写真が薄れて消えるまでの時間とカーブ。
 * 次の写真は下で先に濃くなり、前の写真は遅れて薄れる（終わりは同時）。
 * 2枚とも半分ずつの濃さになる瞬間を作らない（作ると壁の白が透けて光る）。
 *
 * 時間は次の写真が濃くなる時間（--dur-base = 220ms）と揃える。長くすると
 *（300ms で実測）、次の写真が濃くなり終えたところで画面の更新が約0.2秒止まり、
 * 溶ける途中の絵で固まってから切り替わって見えた。
 */
export const SWAP_LEAVE_MS = 220;
export const SWAP_LEAVE_EASE = "cubic-bezier(0.6, 0, 0.9, 0.5)";

export type Ghost = {
  el: HTMLDivElement;
  /** 運ぶ。終わったら（または取り消されたら）解決する。 */
  fly: (to: Rect, ms: number) => Promise<void>;
  /** 薄れて消える。 */
  fadeOut: (ms: number, easing?: string) => Promise<void>;
  remove: () => void;
};

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/**
 * いま画面に出ている画像を、その場で1枚の絵に写し取る。
 *
 * 同じ URL で新しい <img> を作ると、ブラウザの手元に残っていれば即座に出るが、
 * 残っていなければ取り寄せ直しになり、その間は影が空のまま（＝壁の色）になる。
 * ビューアの中の写真は、影を作った直後に隠すか外すので、空の間がそのまま
 * 画面に見える。写し取った絵なら、取り寄せも読み込みも要らない。
 */
function snapshotOf(img: HTMLImageElement, size: Rect): HTMLCanvasElement | null {
  if (!img.complete || img.naturalWidth === 0) return null;
  try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.min(img.naturalWidth, Math.round(size.w * dpr)));
    const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } catch {
    return null;
  }
}

export function createGhost(
  parent: Element,
  /** 画像の URL。画面に出ている画像そのものを渡すと、それを写し取って使う。 */
  source: string | HTMLImageElement,
  from: Rect,
  /** 一覧で写真の「見せる中心」に寄せて切り抜いていれば、その位置。 */
  objectPosition = "50% 50%",
): Ghost {
  const el = document.createElement("div");
  el.className = "lb-ghost";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    left: px(from.x),
    top: px(from.y),
    width: px(from.w),
    height: px(from.h),
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "5",
    willChange: "left, top, width, height",
  } satisfies Partial<CSSStyleDeclaration>);
  const snapshot = typeof source === "string" ? null : snapshotOf(source, from);
  let picture: HTMLImageElement | HTMLCanvasElement;
  if (snapshot) {
    picture = snapshot;
  } else {
    const img = document.createElement("img");
    img.src = typeof source === "string" ? source : source.currentSrc || source.src;
    img.alt = "";
    img.decoding = "sync";
    img.draggable = false;
    picture = img;
  }
  Object.assign(picture.style, {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition,
  } satisfies Partial<CSSStyleDeclaration>);
  el.appendChild(picture);
  parent.appendChild(el);

  let current = from;
  const settle = (a: Animation) =>
    new Promise<void>((resolve) => {
      a.onfinish = () => resolve();
      a.oncancel = () => resolve();
    });

  return {
    el,
    fly(to, ms) {
      const a = el.animate(
        [
          { left: px(current.x), top: px(current.y), width: px(current.w), height: px(current.h) },
          { left: px(to.x), top: px(to.y), width: px(to.w), height: px(to.h) },
        ],
        { duration: ms, easing: MORPH_EASE, fill: "forwards" },
      );
      current = to;
      return settle(a);
    },
    fadeOut(ms, easing = "ease-out") {
      const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: ms,
        easing,
        fill: "forwards",
      });
      return settle(a);
    },
    remove() {
      el.remove();
    },
  };
}
