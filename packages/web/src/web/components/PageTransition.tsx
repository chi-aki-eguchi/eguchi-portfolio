import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { scrollMemory } from "../lib/scroll-memory";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const [display, setDisplay] = useState(children);
  const [opacity, setOpacity] = useState(1);
  const prevLocation = useRef(location);
  const transitioning = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Where the visitor was on each page they have already seen. Going forward to
  // a new page should land at the top, but Back should return them to the spot
  // they left — on a gallery that is thousands of pixels tall, scrolling to 0
  // meant one tap on About threw away all their browsing.
  const poppedTo = useRef<string | null>(null);

  useEffect(() => {
    const remember = () => {
      scrollMemory.remember(prevLocation.current, window.scrollY);
    };
    // Passive scroll listener writing to a ref: no re-render per frame.
    window.addEventListener("scroll", remember, { passive: true });
    const onPop = () => {
      // popstate fires before wouter reports the new location, so just flag
      // that the next change is a Back/Forward and read the target then.
      //
      // 同じページ内で完結する popstate は無視する。写真ビューアは開くときに
      // 自前の履歴を1つ積み、閉じるときに history.back() で戻す（Lightbox.tsx）。
      // その pop は URL を変えないので wouter の location も変わらず、下の
      // location 変更 effect は走らない = この印が消費されないまま残る。
      // 残ったまま次にページを移ると、移動先で「戻るボタンで来た」と誤認して
      // 前のページのスクロール位置を復元しにいく（最大20回・1.2秒間）。
      const next = window.location.pathname + window.location.search;
      if (window.location.pathname === prevLocation.current) return;
      poppedTo.current = next;
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("scroll", remember);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Restore rather than jump to the top when this change came from Back/Forward.
  // Lazy content means the page may still be short, so re-apply over a few
  // frames and stop as soon as it sticks.
  const restoreScroll = useCallback((target: string) => {
    const wanted = scrollMemory.get(target);
    if (wanted <= 0) {
      window.scrollTo(0, 0);
      return;
    }
    let tries = 0;
    const attempt = () => {
      window.scrollTo(0, wanted);
      tries += 1;
      if (Math.abs(window.scrollY - wanted) > 8 && tries < 20)
        setTimeout(attempt, 60);
    };
    attempt();
  }, []);

  const swapAndFadeIn = useCallback(
    (newChildren: React.ReactNode) => {
      const el = containerRef.current;
      if (el) {
        el.style.visibility = "hidden";
        el.style.opacity = "0";
        el.style.transform = "translateY(12px)";
        el.style.transition = "none";
      }

      setDisplay(newChildren);
      const popped = poppedTo.current;
      poppedTo.current = null;
      if (popped) restoreScroll(popped);
      else window.scrollTo(0, 0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) {
          el.style.visibility = "visible";
          el.style.transition =
            "opacity var(--dur-reveal) var(--ease-expo), transform var(--dur-reveal) var(--ease-expo)";
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
        setOpacity(1);
        transitioning.current = false;
      });
    });
    },
    [restoreScroll],
  );

  // The pending swap must read the freshest children without *depending* on
  // them. It used to: `children` was in the dependency list, so when the router
  // delivered the new page mid-fade the cleanup cancelled the timeout, the
  // effect re-ran, and `location === prevLocation.current` returned early
  // without rescheduling. `transitioning` stayed true, so the second effect
  // below could not fall back either — the URL changed and the page did not.
  // Reproducible on Back, where the router updates location and children in the
  // same tick: /gallery in the address bar, /about still on screen.
  const latestChildren = useRef(children);
  latestChildren.current = children;

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;

    const settleScroll = () => {
      const popped = poppedTo.current;
      poppedTo.current = null;
      if (popped) restoreScroll(popped);
      else window.scrollTo(0, 0);
    };

    if (prefersReducedMotion()) {
      setDisplay(latestChildren.current);
      setOpacity(1);
      settleScroll();
      return;
    }

    // Keep page switches in this controlled fade. Chrome's native page snapshots
    // can briefly flash the next page label before the route has settled.
    transitioning.current = true;
    setOpacity(0);

    const t = setTimeout(() => {
      swapAndFadeIn(latestChildren.current);
    }, 250);

    return () => clearTimeout(t);
  }, [location, swapAndFadeIn, restoreScroll]);

  useEffect(() => {
    if (!transitioning.current) setDisplay(children);
  }, [children]);

  return (
    <div
      ref={containerRef}
      style={{
        opacity,
        transition: prefersReducedMotion()
          ? "none"
          : "opacity 250ms var(--ease-exit)",
      }}
    >
      {display}
    </div>
  );
}
