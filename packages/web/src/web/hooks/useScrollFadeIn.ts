import { useEffect, useRef, type DependencyList } from "react";

const HIDDEN_SELECTOR =
  ".fade-in-item:not(.visible), .section-reveal:not(.visible), .page-entrance:not(.visible)";

/**
 * Scroll-based fade-in using Intersection Observer.
 * Watches `.fade-in-item`, `.section-reveal`, and `.page-entrance` children.
 * Re-observes when deps change (e.g. filtered list updates, view switches).
 */
export function useScrollFadeIn(deps: DependencyList = []) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const reveal = (el: HTMLElement) => {
      el.classList.add("visible");
      // Release the will-change GPU layer once settled — photos are numerous,
      // and keeping every settled tile promoted would pin a lot of GPU memory.
      el.addEventListener(
        "transitionend",
        () => {
          el.style.willChange = "auto";
        },
        { once: true },
      );
    };
    const observer = new IntersectionObserver(
      (entries) => {
        // Collect first, then write classes in one rAF — a single style/layout
        // pass instead of N interleaved writes (visible jank with many photos).
        const targets = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement);
        if (targets.length === 0) return;
        targets.forEach((el) => observer.unobserve(el));
        requestAnimationFrame(() =>
          targets.forEach((el, i) => {
            // Stagger within this reveal batch. The tile's inline --stagger-delay
            // is its absolute grid index (capped at 0.4s), which reads right for
            // the initial viewport but makes every later scroll batch wait the
            // full cap uniformly — batch-relative delays keep the cascade
            // without the lag. Non-tile reveals (single sections) get 0s, same
            // as before.
            // 段差。0.05s/0.3s → 0.075s/0.45s（8/30）→ 0.1s/0.55s（8/31）。
            // 一度に立ち上がると「表示された」に見え、順に来ると「現れた」に
            // 見える。**上限はほとんど動かしていない**（0.45→0.55s）。刻みだけ
            // 広げれば最初の数枚の連なりは読めるようになり、1枚目から最後の
            // 1枚までの待ち時間は 100ms しか増えない。
            el.style.setProperty(
              "--stagger-delay",
              `${Math.min(i * 0.1, 0.55)}s`,
            );
            reveal(el);
          }),
        );
      },
      // threshold 0 + positive bottom margin: start the fade ~120px before the
      // element scrolls into view, so it's already animating (not popping) on entry.
      // 動きが長くなったぶん、始まりも早くする。画面に入ってから動き出すと、
      // 見えている場所で1秒かけて濃くなることになる。入る前に動き始めて、
      // 目に入るころには落ち着いている状態にする。
      { threshold: 0, rootMargin: "0px 0px 220px 0px" },
    );
    // An IntersectionObserver only reports a *change*. An element that is
    // already scrolled past when it is handed over never intersects again, so
    // it would stay at opacity 0 forever — reachable by scrolling back up and
    // finding a hole in the grid. That happens whenever a lazy batch lands
    // above the current scroll position: fast flings, Cmd+End, or returning to
    // a restored scroll position. Reveal those immediately instead.
    const observeOrReveal = (el: Element) => {
      const target = el as HTMLElement;
      if (target.getBoundingClientRect().bottom < 0) {
        target.style.setProperty("--stagger-delay", "0s");
        reveal(target);
        return;
      }
      observer.observe(target);
    };

    // Skip already-visible items so deps changes don't re-process the whole grid.
    const items = container.querySelectorAll(HIDDEN_SELECTOR);
    items.forEach(observeOrReveal);

    // Tiles can be committed *after* this effect ran without `deps` changing —
    // PhotoGallery re-renders its grid once its ResizeObserver reports the
    // container width, and the layout branches key off that. Those nodes were
    // never handed to the IntersectionObserver, so they sat at opacity 0
    // permanently: scrolling to them did nothing, because nothing was watching
    // them. Measured on /gallery — 7 to 29 of 60 photos never appeared, and
    // stayed invisible through a second scroll pass and a resize.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(HIDDEN_SELECTOR)) observeOrReveal(node);
          node.querySelectorAll(HIDDEN_SELECTOR).forEach(observeOrReveal);
        }
      }
    });
    mutations.observe(container, { childList: true, subtree: true });
    const safetyTimer = window.setTimeout(() => {
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight || 0;
      container.querySelectorAll(HIDDEN_SELECTOR).forEach((el) => {
          const target = el as HTMLElement;
          const rect = target.getBoundingClientRect();
          if (rect.top <= viewportH + 240 && rect.bottom >= -120) {
            observer.unobserve(target);
            // Recovery path — something already missed its cue, so show it
            // now rather than adding the tile's inline stagger on top.
            target.style.setProperty("--stagger-delay", "0s");
            reveal(target);
          }
      });
    }, 900);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
