import { useEffect, useRef, type DependencyList } from "react";

/**
 * Scroll-based entrance animation using Intersection Observer.
 * Watches `.page-entrance` children and adds `visible` class when in view.
 *
 * Pass `deps` (e.g. the page's data) so the observer re-runs once async content
 * mounts — otherwise elements that render after the first paint (e.g. sections
 * that depend on a settings fetch) never get observed and stay at opacity:0.
 */
export function usePageEntrance(deps: DependencyList = []) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Batch the class writes in one rAF (single style pass, less jank).
        const targets = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement);
        if (targets.length === 0) return;
        targets.forEach((el) => observer.unobserve(el));
        requestAnimationFrame(() =>
          targets.forEach((el) => {
            el.classList.add("visible");
            // Release the will-change layer once the entrance has settled.
            el.addEventListener(
              "transitionend",
              () => {
                el.style.willChange = "auto";
              },
              { once: true },
            );
          }),
        );
      },
      // Fire as soon as the element approaches (small look-ahead) so the
      // entrance is already running when it becomes visible.
      { threshold: 0, rootMargin: "0px 0px 80px 0px" },
    );
    // Re-query each run so newly-mounted `.page-entrance` elements are picked up.
    // Already-visible ones simply re-fire and get unobserved again (no flicker).
    const items = container.querySelectorAll(".page-entrance:not(.visible)");
    items.forEach((el) => observer.observe(el));

    // Safety net: if the Observer callback is cancelled by a rapid cleanup/reconnect
    // (e.g. TanStack Query cache-hit changing photos.length mid-flight), force-reveal
    // any elements still stuck at opacity:0 after 500ms.
    const safetyTimer = setTimeout(() => {
      container
        .querySelectorAll(".page-entrance:not(.visible)")
        .forEach((el) => {
          (el as HTMLElement).classList.add("visible");
        });
    }, 500);

    return () => {
      observer.disconnect();
      clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
