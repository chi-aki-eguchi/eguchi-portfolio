import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

// PageTransition animates via inline styles/JS, so the CSS prefers-reduced-motion
// rules don't reach it — check the media query directly and swap instantly for
// users who asked to minimise motion (also removes the 500ms navigation delay).
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [display, setDisplay] = useState(children);
  const [opacity, setOpacity] = useState(1);
  const prevLocation = useRef(location);
  const transitioning = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const swapAndFadeIn = useCallback((newChildren: React.ReactNode) => {
    // hide container completely before swapping
    const el = containerRef.current;
    if (el) {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition = "none";
    }

    setDisplay(newChildren);
    window.scrollTo(0, 0);

    // wait for React to paint the new content, then fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) {
          el.style.visibility = "visible";
          el.style.transition = "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)";
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
        setOpacity(1);
        transitioning.current = false;
      });
    });
  }, []);

  useEffect(() => {
    if (location === prevLocation.current) return;
    prevLocation.current = location;

    // Reduced motion: swap instantly, no fade-out delay or transform.
    if (prefersReducedMotion()) {
      setDisplay(children);
      setOpacity(1);
      window.scrollTo(0, 0);
      return;
    }

    transitioning.current = true;

    // fade out current page
    setOpacity(0);

    // wait for fade-out to finish fully, then swap
    const t = setTimeout(() => {
      swapAndFadeIn(children);
    }, 500);

    return () => clearTimeout(t);
  }, [location, children, swapAndFadeIn]);

  // same-location data update (no transition)
  useEffect(() => {
    if (!transitioning.current) setDisplay(children);
  }, [children]);

  return (
    <div
      ref={containerRef}
      style={{
        opacity,
        transition: prefersReducedMotion() ? "none" : "opacity 500ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {display}
    </div>
  );
}
