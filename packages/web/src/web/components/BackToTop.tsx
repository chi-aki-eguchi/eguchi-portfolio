import { useState, useEffect } from "react";

/**
 * Floating "back to top" control. Long gallery / series pages can scroll for
 * screens; without this the only way back to the nav (and the Contact link) is a
 * long manual scroll. Appears after the first viewport, bottom-left so it clears
 * the bottom-right platform badge. Honours prefers-reduced-motion.
 *
 * The left sidebar and the bottom nav both own that corner, and the header is
 * z-50 against this z-40 — the button rendered but nothing could click it. The
 * `.back-to-top` class exists so styles.css can move it clear per nav position.
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
      className={`back-to-top fixed z-40 w-10 h-10 flex items-center justify-center rounded-full border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--background-rgb),0.7)] backdrop-blur-md text-[color:var(--text-quiet)] transition-[opacity,transform,color,border-color] duration-300 ease-[var(--ease-quart)] hover:text-[rgba(var(--foreground-rgb),0.85)] hover:border-[rgba(var(--foreground-rgb),0.28)] ${
        show ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      // The offsets read custom properties so styles.css can move the button
      // per nav position. They cannot be plain CSS rules: this inline style
      // beats any stylesheet, which is why both the Tailwind utilities and a
      // later `.nav-pos-left .back-to-top` rule were silently inert.
      style={{
        WebkitBackdropFilter: "blur(8px)",
        bottom: "calc(var(--back-to-top-bottom, 1.5rem) + var(--sai-bottom))",
        left: "calc(var(--back-to-top-left, 1.5rem) + var(--sai-left))",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
