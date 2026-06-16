import { useState, useEffect } from "react";

/**
 * Floating "back to top" control. Long gallery / series pages can scroll for
 * screens; without this the only way back to the nav (and the Contact link) is a
 * long manual scroll. Appears after the first viewport, bottom-left so it clears
 * the bottom-right platform badge. Honours prefers-reduced-motion.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="ページ上部へ戻る"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={`fixed bottom-6 left-6 z-40 w-10 h-10 flex items-center justify-center rounded-full border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--background-rgb),0.7)] backdrop-blur-md text-[rgba(var(--foreground-rgb),0.55)] transition-[opacity,transform,color,border-color] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:text-[rgba(var(--foreground-rgb),0.85)] hover:border-[rgba(var(--foreground-rgb),0.28)] ${
        show ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      style={{ WebkitBackdropFilter: "blur(8px)" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
