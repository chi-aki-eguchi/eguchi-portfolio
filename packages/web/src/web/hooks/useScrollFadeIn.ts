import { useEffect, useRef, type DependencyList } from "react";

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
            el.style.setProperty(
              "--stagger-delay",
              `${Math.min(i * 0.05, 0.3)}s`,
            );
            reveal(el);
          }),
        );
      },
      // threshold 0 + positive bottom margin: start the fade ~120px before the
      // element scrolls into view, so it's already animating (not popping) on entry.
      { threshold: 0, rootMargin: "0px 0px 120px 0px" },
    );
    // Skip already-visible items so deps changes don't re-process the whole grid.
    const items = container.querySelectorAll(
      ".fade-in-item:not(.visible), .section-reveal:not(.visible), .page-entrance:not(.visible)",
    );
    items.forEach((el) => observer.observe(el));
    const safetyTimer = window.setTimeout(() => {
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight || 0;
      container
        .querySelectorAll(
          ".fade-in-item:not(.visible), .section-reveal:not(.visible), .page-entrance:not(.visible)",
        )
        .forEach((el) => {
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
      window.clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
