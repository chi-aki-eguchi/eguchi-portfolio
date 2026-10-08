import { useEffect, type RefObject } from "react";

/**
 * 左の縦メニューの印（短い線）を、1本の線として動かす。
 *
 * マウスやキーボードで触れた項目へ滑り、離れるといまのページへ帰る。
 * ページを移れば新しい行き先へ移る。線そのものは CSS（styles.css の
 * `ul[data-rail]::before`）が描き、ここは高さ（--rail-y）を書くだけ。
 *
 * 上・下のメニューや狭い画面では CSS 側が線を描かないので、何も起きない。
 * JS が動かない・間に合わないあいだは、従来の「項目ごとの線」がそのまま出る。
 */
export function useRailMarker(listRef: RefObject<HTMLElement | null>, routeKey: string) {
  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    let held: HTMLElement | null = null;

    const place = () => {
      const target =
        held && ul.contains(held)
          ? held
          : ul.querySelector<HTMLElement>('a.nav-link-public[aria-current="page"]');
      if (!target) {
        // いまのページがメニューに無い（トップなど）: 線は最後の場所で消える。
        ul.setAttribute("data-rail", "off");
        return;
      }
      const box = ul.getBoundingClientRect();
      const row = target.getBoundingClientRect();
      if (!row.height) return;
      ul.style.setProperty("--rail-y", `${Math.round(row.top - box.top + row.height / 2)}px`);
      ul.setAttribute("data-rail", "on");
    };

    const linkOf = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>("a.nav-link-public") : null;
    const onOver = (e: Event) => {
      const a = linkOf(e.target);
      if (!a || a === held) return;
      held = a;
      place();
    };
    const onLeave = () => {
      held = null;
      place();
    };

    place();
    // 最初の1回は滑らせない（0 の位置から走ってこないように、置いてから動きを許す）。
    const ready = requestAnimationFrame(() => ul.setAttribute("data-rail-ready", ""));
    ul.addEventListener("pointerover", onOver);
    ul.addEventListener("pointerleave", onLeave);
    ul.addEventListener("focusin", onOver);
    ul.addEventListener("focusout", onLeave);
    // 書体が届く・項目が増える（言語の切り替えなど）と行の高さが変わる。
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    ro?.observe(ul);

    return () => {
      cancelAnimationFrame(ready);
      ul.removeEventListener("pointerover", onOver);
      ul.removeEventListener("pointerleave", onLeave);
      ul.removeEventListener("focusin", onOver);
      ul.removeEventListener("focusout", onLeave);
      ro?.disconnect();
    };
  }, [listRef, routeKey]);
}
