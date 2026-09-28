import { useEffect } from "react";

/** Lazy sales/guide content may mount after the browser has tried its anchor. */
export function useInitialHashScroll() {
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;
    let second = 0;
    // Let the route's initial scroll reset finish. Do this once, without a
    // retry timer that could pull the reader back after they start scrolling.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
}
