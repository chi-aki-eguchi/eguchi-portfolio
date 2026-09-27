import { useLayoutEffect, useState, type RefObject } from "react";

export type NavFit = {
  /** リンクが入りきらないので、PC でもハンバーガーにまとめる */
  collapsed: boolean;
  /** 左のメニューの帯の幅（px）。既定の 11rem で足りるときは null */
  railPx: number | null;
};

const FITS: NavFit = { collapsed: false, railPx: null };

/** 左のメニューの帯（styles.css「BB1: nav position」と同じ値） */
const RAIL_REM = 11;
const RAIL_PADDING_REM = 4; // 左右 2rem ずつ
const RAIL_LINK_INDENT = 18; // 選んでいないリンクの字下げ
/** 帯を広げてよい上限。これを超えるなら、上のバーとハンバーガーへまとめる */
const RAIL_MAX_REM = 20;
const RAIL_MAX_VIEWPORT = 0.3;

function textWidth(el: Element): number {
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return rect.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
}

/**
 * いつもの構成のメニューが入りきるかを測る（2026-09-26）。
 *
 * 管理画面ではメニューの文字を 8〜48px、文字全体を 0.5〜2 倍にできる。大きくすると
 * 上のメニューが画面の外へはみ出し、左のメニューは帯からはみ出して写真に重なっていた。
 *
 * - 上・下: 名前とリンクが横1列に入りきらなければ、PC でもハンバーガーにまとめる。
 * - 左: いちばん長いリンクに合わせて帯を広げる（最大 20rem・画面の 30%）。それでも
 *   入らなければ、上のバーとハンバーガーにまとめる。
 *
 * リンクは折り返さない（`white-space: nowrap`）ので、文字の幅はまとめる前と後で
 * 変わらない。まとめたせいで「入る」と判定し直して行ったり来たりすることがない。
 * スマホ（768px 未満）はもともとハンバーガーなので測らない。
 */
export function useNavFit(
  navRef: RefObject<HTMLElement | null>,
  logoRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
  position: string,
  contentKey: string,
): NavFit {
  const [fit, setFit] = useState<NavFit>(FITS);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    if (!nav || !list) return;
    const wide = window.matchMedia("(min-width: 768px)");
    const measure = () => {
      if (!wide.matches) {
        setFit((prev) => (prev === FITS ? prev : FITS));
        return;
      }
      const items = Array.from(list.children)
        .map((li) => li.firstElementChild)
        .filter((el): el is Element => !!el)
        .map(textWidth);
      // 空（まだ描いていない・隠れている）なら何も決めない。
      if (items.every((w) => w <= 0)) return;
      let next: NavFit;
      if (position === "left") {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        // 選んでいるリンクは少し太字になるぶん（5%）を見込む。
        const widest = Math.max(...items.map((w) => w * 1.05 + RAIL_LINK_INDENT));
        const rail = Math.ceil(Math.max(RAIL_REM * rem, widest + RAIL_PADDING_REM * rem));
        const maxRail = Math.min(RAIL_MAX_REM * rem, window.innerWidth * RAIL_MAX_VIEWPORT);
        next =
          rail > maxRail
            ? { collapsed: true, railPx: null }
            : { collapsed: false, railPx: rail > RAIL_REM * rem ? rail : null };
      } else {
        const cs = getComputedStyle(nav);
        const inner =
          nav.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
        const gap = parseFloat(getComputedStyle(list).columnGap) || 32;
        const logo = logoRef.current ? logoRef.current.getBoundingClientRect().width : 0;
        const needed =
          logo + 32 + items.reduce((a, b) => a + b, 0) + gap * Math.max(0, items.length - 1);
        next = { collapsed: needed > inner, railPx: null };
      }
      setFit((prev) =>
        prev.collapsed === next.collapsed && prev.railPx === next.railPx ? prev : next,
      );
    };
    measure();
    wide.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(nav);
    // リンク（インライン要素）は ResizeObserver が拾わないので、包む li を見る。
    for (const li of Array.from(list.children)) ro?.observe(li);
    if (logoRef.current) ro?.observe(logoRef.current);
    // 文字の大きさが変わるのは、Web フォントが届いたときも。
    let alive = true;
    document.fonts?.ready.then(() => alive && measure()).catch(() => {});
    return () => {
      alive = false;
      wide.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [navRef, logoRef, listRef, position, contentKey]);
  return fit;
}
