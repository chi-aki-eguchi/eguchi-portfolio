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
    const observer = new IntersectionObserver(
      (entries) => {
        // Collect first, then write classes in one rAF — a single style/layout
        // pass instead of N interleaved writes (visible jank with many photos).
        const targets = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (targets.length === 0) return;
        targets.forEach((el) => observer.unobserve(el));
        requestAnimationFrame(() => targets.forEach((el) => {
          el.classList.add("visible");
          // Release the will-change GPU layer once settled — photos are numerous,
          // and keeping every settled tile promoted would pin a lot of GPU memory.
          el.addEventListener("transitionend", () => { el.style.willChange = "auto"; }, { once: true });
        }));
      },
      // threshold 0 + positive bottom margin: start the fade ~120px before the
      // element scrolls into view, so it's already animating (not popping) on entry.
      { threshold: 0, rootMargin: "0px 0px 120px 0px" }
    );
    // Skip already-visible items so deps changes don't re-process the whole grid.
    const items = container.querySelectorAll(".fade-in-item:not(.visible), .section-reveal:not(.visible), .page-entrance:not(.visible)");
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
