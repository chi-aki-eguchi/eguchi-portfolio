import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { safeHref } from "../lib/utils";
import { BackToTop } from "./BackToTop";
import { useDarkModeContext } from "./provider";

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
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const SERVICE_LINK_HOST = "akieguchi.com";

function normalizedHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return normalizedHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

function shouldShowServiceLink(siteUrl: string | undefined): boolean {
  if (hostFromUrl(siteUrl) === SERVICE_LINK_HOST) return true;
  if (typeof window === "undefined") return false;
  return normalizedHost(window.location.hostname) === SERVICE_LINK_HOST;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const footerRef = useFooterReveal();

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  // I1: Series nav visibility. "on"/"off" force it; "auto" (default) shows the
  // link iff at least one published series exists — so created series surface on
  // their own instead of staying invisible behind an opt-in toggle. Only "auto"
  // needs the series list, so the query is gated to avoid a fetch otherwise.
  const seriesNav = data?.seriesNavEnabled ?? "auto";
  const seriesAuto = seriesNav !== "on" && seriesNav !== "off";
  const { data: seriesData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
    enabled: seriesAuto,
  });
  const showSeries =
    seriesNav === "on" || (seriesAuto && (seriesData?.series.length ?? 0) > 0);

  const dm = useDarkModeContext();
  const siteNameJa = data?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const showServiceLink = shouldShowServiceLink(data?.siteUrl);
  const navItems = [
    { href: "/gallery", label: data?.navLabelGallery ?? "Gallery" },
    ...(showSeries ? [{ href: "/series", label: "Series" }] : []),
    { href: "/about", label: data?.navLabelAbout ?? "About" },
    { href: "/contact", label: data?.navLabelContact ?? "Contact" },
    ...(showServiceLink ? [{ href: "/service", label: "Service" }] : []),
  ];

  // Highlight the nav item for the section you're in, not just its exact path:
  // Series stays active on /series/:slug, and About covers its /profile alias.
  const isActive = (href: string) => {
    if (href === "/about")
      return location === "/about" || location === "/profile";
    return location === href || location.startsWith(`${href}/`);
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const navTextStyle = { fontSize: "var(--nav-size, 13px)" };

  // BB: nav position / hover effect — values sanitised so an odd DB value can
  // never inject an unknown class. Defaults reproduce the current look.
  const navPosition = ["top", "left", "bottom"].includes(
    data?.navPosition ?? "",
  )
    ? data!.navPosition
    : "top";
  const navHoverEffect = ["fade", "underline", "dot", "blur"].includes(
    data?.navHoverEffect ?? "",
  )
    ? data!.navHoverEffect
    : "fade";

  // No background on this wrapper — body paints var(--background); an opaque
  // layer here would cover the DD grain texture (body::before at z-index:-1).
  return (
    <div
      className={`min-h-screen text-[var(--foreground)] nav-pos-${navPosition} nav-fx-${navHoverEffect}`}
    >
      {/* Skip link — visible only on keyboard focus, lets SR/keyboard users jump past the nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[var(--background)] focus:text-[var(--foreground)] focus:px-4 focus:py-2 focus:rounded focus:shadow focus:font-en focus:text-sm focus:border focus:border-[rgba(var(--foreground-rgb),0.2)]"
      >
        本文へスキップ
      </a>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-[background-color,box-shadow,backdrop-filter,-webkit-backdrop-filter] duration-300 ease-[var(--ease-quart)] ${
          scrolled
            ? "bg-[rgba(var(--background-rgb),0.82)] backdrop-blur-[14px] shadow-[0_1px_0_rgba(var(--foreground-rgb),0.04)]"
            : "bg-[var(--background)]"
        }`}
        style={{
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          paddingTop: "var(--sai-top)",
        }}
      >
        <nav className="max-w-5xl mx-auto px-6 md:px-12 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="font-en text-sm font-semibold tracking-[0.08em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-300 inline-flex items-center min-h-[44px]"
          >
            {data?.navLabelTop ?? "TOP"}
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex gap-8 items-center">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <Link
                  to={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className="font-en nav-link-luxury nav-link-public"
                  style={
                    {
                      ...navTextStyle,
                      letterSpacing: "var(--nav-tracking, 0.04em)",
                      "--link-rest": "var(--nav-opacity, 0.35)",
                    } as React.CSSProperties
                  }
                >
                  {label}
                </Link>
              </li>
            ))}
            {dm && (
              <li>
                <button
                  onClick={dm.toggle}
                  aria-label={
                    dm.resolved === "dark"
                      ? "ライトモードに切り替え"
                      : "ダークモードに切り替え"
                  }
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-300 hover:bg-[rgba(var(--foreground-rgb),0.06)]"
                  style={{
                    color: `rgba(var(--foreground-rgb), var(--nav-opacity, 0.35))`,
                  }}
                >
                  {dm.resolved === "dark" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              </li>
            )}
          </ul>

          {/* Dark mode toggle + Mobile hamburger */}
          <div className="md:hidden flex items-center gap-0.5">
            {dm && (
              <button
                onClick={dm.toggle}
                aria-label={
                  dm.resolved === "dark"
                    ? "ライトモードに切り替え"
                    : "ダークモードに切り替え"
                }
                className="w-10 h-10 flex items-center justify-center text-[var(--foreground)]"
                style={{ opacity: 0.45 }}
              >
                {dm.resolved === "dark" ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            )}
            {/* 44px hit target (HIG minimum) — bars stay 20px; -mr keeps their visual
              right-edge where the old 32px button had it. */}
            <button
              className="w-11 h-11 -mr-1.5 flex flex-col items-center justify-center gap-[5px] text-[var(--foreground)]"
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
          </div>
        </nav>

        {/* Mobile menu — `inert` when closed so its links aren't tabbable/announced
            while collapsed (they stay in the DOM for the height transition). */}
        <div
          id="mobile-menu"
          inert={!mobileOpen}
          className={`md:hidden overflow-hidden transition-all duration-350 ease-[var(--ease-quart)] ${
            mobileOpen
              ? "max-h-52 border-t border-[rgba(var(--foreground-rgb),0.05)]"
              : "max-h-0"
          } bg-[var(--background)]`}
        >
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              aria-current={isActive(href) ? "page" : undefined}
              className="block px-5 py-3 font-en nav-link-public"
              style={
                {
                  fontSize: "var(--nav-size, 14px)",
                  letterSpacing: "var(--nav-tracking, 0.04em)",
                  "--link-rest": "var(--nav-opacity, 0.35)",
                } as React.CSSProperties
              }
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none"
        style={{ paddingTop: "calc(var(--header-h) + var(--sai-top))" }}
      >
        {children}
      </main>

      <footer
        className="pt-[calc(3rem*var(--spacing-footer-top,1))] footer-reveal"
        ref={footerRef}
        style={{ paddingBottom: "calc(2rem + var(--sai-bottom))" }}
      >
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col items-center gap-4">
          {/* SNS Links */}
          {(data?.profileInstagram ||
            data?.profileTwitter ||
            data?.profileNote) && (
            <nav aria-label="SNS" className="flex gap-6">
              {data?.profileInstagram && (
                <a
                  href={safeHref(data.profileInstagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
                  style={
                    {
                      "--link-rest": "var(--sns-opacity, 0.25)",
                    } as React.CSSProperties
                  }
                >
                  {data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a
                  href={safeHref(data.profileTwitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
                  style={
                    {
                      "--link-rest": "var(--sns-opacity, 0.25)",
                    } as React.CSSProperties
                  }
                >
                  {data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a
                  href={safeHref(data.profileNote)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
                  style={
                    {
                      "--link-rest": "var(--sns-opacity, 0.25)",
                    } as React.CSSProperties
                  }
                >
                  {data?.snsLabelNote ?? "note"}
                </a>
              )}
            </nav>
          )}
          {/* E6: optional, low-key lead-in to Contact (hidden when empty) */}
          {data?.footerCtaLabel && (
            <Link
              to="/contact"
              className="font-en tracking-[0.06em] nav-link-luxury footer-link-public"
              style={
                {
                  fontSize: "var(--footer-size, 11px)",
                  "--link-rest": "var(--footer-opacity, 0.30)",
                } as React.CSSProperties
              }
            >
              {data.footerCtaLabel}
            </Link>
          )}
          {showServiceLink && (
            <Link
              to="/service"
              className="font-en tracking-[0.06em] nav-link-luxury footer-link-public"
              style={
                {
                  fontSize: "var(--footer-size, 11px)",
                  "--link-rest": "var(--footer-opacity, 0.22)",
                } as React.CSSProperties
              }
            >
              Portfolio site
            </Link>
          )}
          <p
            className="font-en text-center"
            style={{
              fontSize: "var(--footer-size, 11px)",
              letterSpacing: "0.04em",
              color: `rgba(var(--foreground-rgb), var(--footer-opacity, 0.20))`,
            }}
          >
            {data?.footerText || `© ${new Date().getFullYear()} ${siteNameJa}`}
          </p>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
