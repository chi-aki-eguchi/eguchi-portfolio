import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasViewTransitions(): boolean {
  return typeof document !== "undefined"
    && "startViewTransition" in document
    && window.parent === window;
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [display, setDisplay] = useState(children);
  const [opacity, setOpacity] = useState(1);
  const prevLocation = useRef(location);
  const transitioning = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const swapAndFadeIn = useCallback((newChildren: React.ReactNode) => {
    const el = containerRef.current;
    if (el) {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition = "none";
    }

    setDisplay(newChildren);
    window.scrollTo(0, 0);

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

    if (prefersReducedMotion()) {
      setDisplay(children);
      setOpacity(1);
      window.scrollTo(0, 0);
      return;
    }

    // Use View Transitions API when available for smoother page switches.
    if (hasViewTransitions()) {
      transitioning.current = true;
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        setDisplay(children);
        setOpacity(1);
        window.scrollTo(0, 0);
        transitioning.current = false;
      });
      return;
    }

    transitioning.current = true;
    setOpacity(0);

    const t = setTimeout(() => {
      swapAndFadeIn(children);
    }, 500);

    return () => clearTimeout(t);
  }, [location, children, swapAndFadeIn]);

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
