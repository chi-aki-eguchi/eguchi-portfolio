import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { BackToTop } from "./BackToTop";

function useFooterReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const footerRef = useFooterReveal();

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });

  // I1: Series nav visibility. "on"/"off" force it; "auto" (default) shows the
  // link iff at least one published series exists — so created series surface on
  // their own instead of staying invisible behind an opt-in toggle. Only "auto"
  // needs the series list, so the query is gated to avoid a fetch otherwise.
  const seriesNav = data?.seriesNavEnabled ?? "auto";
  const seriesAuto = seriesNav !== "on" && seriesNav !== "off";
  const { data: seriesData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => (await api.series.$get()).json(),
    enabled: seriesAuto,
  });
  const showSeries = seriesNav === "on" || (seriesAuto && (seriesData?.series.length ?? 0) > 0);

  const siteNameJa = data?.siteName ?? "江口秋";
  const navItems = [
    { href: "/gallery", label: data?.navLabelGallery ?? "Gallery" },
    ...(showSeries ? [{ href: "/series", label: "Series" }] : []),
    { href: "/about", label: data?.navLabelAbout ?? "About" },
    { href: "/contact", label: data?.navLabelContact ?? "Contact" },
  ];

  // Highlight the nav item for the section you're in, not just its exact path:
  // Series stays active on /series/:slug, and About covers its /profile alias.
  const isActive = (href: string) => {
    if (href === "/about") return location === "/about" || location === "/profile";
    return location === href || location.startsWith(`${href}/`);
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const navTextStyle = { fontSize: "var(--nav-size, 13px)" };

  // BB: nav position / hover effect — values sanitised so an odd DB value can
  // never inject an unknown class. Defaults reproduce the current look.
  const navPosition = ["top", "left", "bottom"].includes(data?.navPosition ?? "") ? data!.navPosition : "top";
  const navHoverEffect = ["fade", "underline", "dot", "blur"].includes(data?.navHoverEffect ?? "") ? data!.navHoverEffect : "fade";

  // No background on this wrapper — body paints var(--background); an opaque
  // layer here would cover the DD grain texture (body::before at z-index:-1).
  return (
    <div className={`min-h-screen text-[var(--foreground)] nav-pos-${navPosition} nav-fx-${navHoverEffect}`}>
      {/* Skip link — visible only on keyboard focus, lets SR/keyboard users jump past the nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[var(--background)] focus:text-[var(--foreground)] focus:px-4 focus:py-2 focus:rounded focus:shadow focus:font-en focus:text-sm focus:border focus:border-[rgba(var(--foreground-rgb),0.2)]"
      >
        本文へスキップ
      </a>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          scrolled
            ? "bg-[rgba(var(--background-rgb),0.82)] backdrop-blur-[14px] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
            : "bg-[var(--background)]"
        }`}
        style={{ WebkitBackdropFilter: scrolled ? "blur(14px)" : "none" }}
      >
        <nav className="max-w-5xl mx-auto px-6 md:px-12 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="font-en text-sm font-semibold tracking-[0.08em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-300"
          >
            {data?.navLabelTop ?? "TOP"}
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex gap-8">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link
                  to={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className="font-en transition-colors duration-300 nav-link-luxury"
                  style={{
                    ...navTextStyle,
                    letterSpacing: "var(--nav-tracking, 0.04em)",
                    color: isActive(href)
                      ? `var(--accent-color, rgba(var(--foreground-rgb), 0.70))`
                      : `rgba(var(--foreground-rgb), var(--nav-opacity, 0.35))`,
                  }}
                  onMouseEnter={(e) => { if (!isActive(href)) e.currentTarget.style.color = `var(--accent-color, rgba(var(--foreground-rgb), 0.60))`; }}
                  onMouseLeave={(e) => { if (!isActive(href)) e.currentTarget.style.color = `rgba(var(--foreground-rgb), var(--nav-opacity, 0.35))`; }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile hamburger */}
          {/* 44px hit target (HIG minimum) — bars stay 20px; -mr keeps their visual
              right-edge where the old 32px button had it. */}
          <button
            className="md:hidden w-11 h-11 -mr-1.5 flex flex-col items-center justify-center gap-[5px] text-[var(--foreground)]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <span
              className={`block w-5 h-[1.5px] bg-current transition-all duration-300 ${
                mobileOpen ? "rotate-45 translate-y-[6.5px]" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-current transition-all duration-300 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-current transition-all duration-300 ${
                mobileOpen ? "-rotate-45 -translate-y-[6.5px]" : ""
              }`}
            />
          </button>
        </nav>

        {/* Mobile menu — `inert` when closed so its links aren't tabbable/announced
            while collapsed (they stay in the DOM for the height transition). */}
        <div
          id="mobile-menu"
          inert={!mobileOpen}
          className={`md:hidden overflow-hidden transition-all duration-350 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            mobileOpen ? "max-h-52 border-t border-[rgba(var(--foreground-rgb),0.05)]" : "max-h-0"
          } bg-[var(--background)]`}
        >
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              aria-current={isActive(href) ? "page" : undefined}
              className="block px-5 py-3 font-en transition-colors duration-300"
              style={{
                fontSize: "var(--nav-size, 14px)",
                letterSpacing: "var(--nav-tracking, 0.04em)",
                color: isActive(href)
                  ? `rgba(var(--foreground-rgb), 0.70)`
                  : `rgba(var(--foreground-rgb), var(--nav-opacity, 0.35))`,
              }}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="pt-14 outline-none">{children}</main>

      <footer className="pt-[calc(3rem*var(--spacing-footer-top,1))] pb-8 footer-reveal" ref={footerRef}>
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col items-center gap-4">
          {/* SNS Links */}
          {(data?.profileInstagram || data?.profileTwitter || data?.profileNote) && (
            <div className="flex gap-6">
              {data?.profileInstagram && (
                <a href={data.profileInstagram} target="_blank" rel="noopener noreferrer"
                  className="font-en text-[11px] tracking-[0.06em] nav-link-luxury transition-colors duration-300"
                  style={{ color: `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), 0.50)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))`; }}>
                  {data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a href={data.profileTwitter} target="_blank" rel="noopener noreferrer"
                  className="font-en text-[11px] tracking-[0.06em] nav-link-luxury transition-colors duration-300"
                  style={{ color: `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), 0.50)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))`; }}>
                  {data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a href={data.profileNote} target="_blank" rel="noopener noreferrer"
                  className="font-en text-[11px] tracking-[0.06em] nav-link-luxury transition-colors duration-300"
                  style={{ color: `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))` }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), 0.50)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), var(--sns-opacity, 0.25))`; }}>
                  {data?.snsLabelNote ?? "note"}
                </a>
              )}
            </div>
          )}
          {/* E6: optional, low-key lead-in to Contact (hidden when empty) */}
          {data?.footerCtaLabel && (
            <Link
              to="/contact"
              className="font-en tracking-[0.06em] nav-link-luxury transition-colors duration-300"
              style={{ fontSize: "var(--footer-size, 11px)", color: `rgba(var(--foreground-rgb), var(--footer-opacity, 0.30))` }}
              onMouseEnter={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), 0.55)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), var(--footer-opacity, 0.30))`; }}
            >
              {data.footerCtaLabel}
            </Link>
          )}
          <p
            className="font-en text-center"
            style={{ fontSize: "var(--footer-size, 11px)", letterSpacing: "0.04em", color: `rgba(var(--foreground-rgb), var(--footer-opacity, 0.20))` }}
          >
            {data?.footerText || `© ${new Date().getFullYear()} ${siteNameJa}`}
          </p>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
