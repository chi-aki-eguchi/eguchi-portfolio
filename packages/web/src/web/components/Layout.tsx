import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { httpHrefOrNull, safeHref } from "../lib/utils";
import { BackToTop } from "./BackToTop";
import { useDarkModeContext, useServiceVisibility } from "./provider";
import { hasPublicEnglishContent } from "../../shared/public-english";

// i18n Phase 3 スライス1: /about・/contact の英語ペア。/profile は /about の
// エイリアスなので EN→JA 側は常に /about を正とする（ogp.ts の canonPath 扱いに合わせる）。
const JA_TO_EN_PATH: Record<string, string> = {
  "/about": "/en/about",
  "/profile": "/en/about",
  "/contact": "/en/contact",
};
const EN_TO_JA_PATH: Record<string, string> = {
  "/en/about": "/about",
  "/en/contact": "/contact",
};

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

// i18n Phase 3 スライス1: nav末尾に出す JP | EN 切り替え。他の nav リンクと
// 同じ font-en の控えめなトーン。現在の言語は非リンクで濃く表示し、もう一方は
// 通常の nav リンクとして遷移可能にする。
function LanguageSwitchLinks({
  isEnglishPage,
  jaHref,
  enHref,
}: {
  isEnglishPage: boolean;
  jaHref: string;
  enHref: string;
}) {
  const linkStyle = {
    letterSpacing: "var(--nav-tracking, 0.04em)",
    "--link-rest": "var(--nav-opacity, 0.35)",
  } as React.CSSProperties;
  return (
    <span
      className="font-en inline-flex items-center gap-1.5"
      style={{ fontSize: "0.7rem" }}
    >
      {isEnglishPage ? (
        <Link to={jaHref} className="nav-link-luxury nav-link-public" style={linkStyle}>
          JP
        </Link>
      ) : (
        <span
          aria-current="page"
          style={{ color: `rgba(var(--foreground-rgb),0.76)` }}
        >
          JP
        </span>
      )}
      <span
        aria-hidden="true"
        style={{ color: `rgba(var(--foreground-rgb),0.20)` }}
      >
        |
      </span>
      {isEnglishPage ? (
        <span
          aria-current="page"
          style={{ color: `rgba(var(--foreground-rgb),0.76)` }}
        >
          EN
        </span>
      ) : (
        <Link to={enHref} className="nav-link-luxury nav-link-public" style={linkStyle}>
          EN
        </Link>
      )}
    </span>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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
  const { showServiceInNav } = useServiceVisibility();
  const siteNameJa = data?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const templateCreditUrl = httpHrefOrNull(data?.templateCreditUrl ?? "");

  // i18n Phase 3 スライス1: /en/about・/en/contact 表示中は About/Contact の
  // リンク先を英語パスへ。Gallery・Series・Portfolio Kit は対象外（JPのまま）。
  const isEnglishPage = location in EN_TO_JA_PATH;
  // 英語文が一つも入力されていないサイト(配布テンプレート既定)では JP|EN を
  // 出さない。ENページ表示中だけは例外 — 直接URLで来た人がJPへ戻れるように。
  const showLanguageSwitch =
    isEnglishPage || hasPublicEnglishContent(data ?? {});
  const languagePairHref = isEnglishPage
    ? EN_TO_JA_PATH[location]
    : JA_TO_EN_PATH[location];

  const navItems = [
    { href: "/gallery", label: data?.navLabelGallery ?? "Gallery" },
    ...(showSeries ? [{ href: "/series", label: "Series" }] : []),
    {
      href: isEnglishPage ? "/en/about" : "/about",
      label: data?.navLabelAbout ?? "About",
    },
    {
      href: isEnglishPage ? "/en/contact" : "/contact",
      label: data?.navLabelContact ?? "Contact",
    },
    ...(showServiceInNav
      ? [{ href: "/portfolio-kit", label: "Portfolio Kit" }]
      : []),
  ];

  // Highlight the nav item for the section you're in, not just its exact path:
  // Series stays active on /series/:slug, About covers its /profile alias, and
  // both About/Contact stay active across their /en/* counterpart.
  const canonicalSection = (path: string): "about" | "contact" | null => {
    if (path === "/about" || path === "/profile" || path === "/en/about")
      return "about";
    if (path === "/contact" || path === "/en/contact") return "contact";
    return null;
  };
  const isActive = (href: string) => {
    const section = canonicalSection(href);
    if (section) return canonicalSection(location) === section;
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

  // Escape closes the open menu, and focus goes back to the button that opened
  // it. Without this the only way out was the burger or picking a destination —
  // every other dismissible surface on the site (the photo viewer, the admin
  // dialogs) closes on Escape, so it reads as stuck.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

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

  // ページ最上部でのヘッダーの地（2026-08-09 オーナー依頼「上の帯の白を無くす
  // ／文字だけ・薄いフェードも選べるように」）。
  //  - solid（既定）: 今までどおり地を塗る
  //  - fade: 上から下へ薄れる幕。文字の後ろにわずかに残す
  //  - none: 地を置かない。文字だけが写真の上に乗る
  //
  // **スクロール後は3つとも今までどおり、ぼかした帯へ戻す。** 帯が消えるのは
  // 最上部だけ。写真の上を外れて本文が流れてくると、地が無いままではリンクが
  // 読めなくなる。
  //
  // 地を透かしても、その裏が本文の余白なら同じ色の帯が残るだけで意味がない。
  // 実測（本番 2026-08-09）でも HERO は header の下ではなく **56px 下から**
  // 始まっていた。だから透かすときは、全画面HEROを header の下まで伸ばす
  // （CSS 側 `.header-see-through`）。全画面HEROでない構成では裏が本文の余白
  // なので、見た目はほぼ変わらない。管理画面の説明にもそう書いてある。
  const headerBackground = ["solid", "fade", "none"].includes(
    data?.headerBackground ?? "",
  )
    ? data!.headerBackground!
    : "solid";
  const seeThrough = headerBackground !== "solid";

  // フッターの並べ方。全ページの終わりに必ず出るのに、これまで「中央に積む」の
  // 1種類しか無く、買った人全員が同じ終わり方になっていた。
  //   center — 中央に積む（既定。従来どおり）
  //   left   — 左に寄せて積む
  //   split  — SNSを左、著作表示を右（PCのみ横並び。スマホは縦に積む）
  const footerLayout = ["center", "left", "split"].includes(
    data?.footerLayout ?? "",
  )
    ? data!.footerLayout!
    : "center";

  // No background on this wrapper — body paints var(--background); an opaque
  // layer here would cover the DD grain texture (body::before at z-index:-1).
  return (
    <div
      className={`min-h-screen text-[var(--foreground)] nav-pos-${navPosition} nav-fx-${navHoverEffect}${
        seeThrough ? " header-see-through" : ""
      }`}
    >
      {/* Skip link — visible only on keyboard focus, lets SR/keyboard users jump past the nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[var(--background)] focus:text-[var(--foreground)] focus:px-4 focus:py-2 focus:rounded focus:shadow focus:font-en focus:text-sm focus:border focus:border-[rgba(var(--foreground-rgb),0.2)]"
      >
        {isEnglishPage ? "Skip to content" : "本文へスキップ"}
      </a>
      <header
        data-header-bg={headerBackground}
        className={`fixed top-0 left-0 w-full z-50 transition-[background-color,box-shadow,backdrop-filter,-webkit-backdrop-filter] duration-300 ease-[var(--ease-quart)] ${
          scrolled
            ? "bg-[rgba(var(--background-rgb),0.82)] backdrop-blur-[14px] shadow-[0_1px_0_rgba(var(--foreground-rgb),0.04)]"
            : seeThrough
              ? "site-header-see-through"
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
            {showLanguageSwitch && languagePairHref && (
              <li>
                <LanguageSwitchLinks
                  isEnglishPage={isEnglishPage}
                  jaHref={isEnglishPage ? languagePairHref : location}
                  enHref={isEnglishPage ? location : languagePairHref}
                />
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
              ref={menuButtonRef}
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
              ? // i18n Phase 3 スライス1: About/Contact ページで JP|EN 行が1段追加され
                // うるため、既存 max-h-52 では最大構成(Gallery/Series/About/Contact/
                // Portfolio Kit)時に切れる余地があった。実測余裕を見て max-h-64 に。
                "max-h-64 border-t border-[rgba(var(--foreground-rgb),0.05)]"
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
          {showLanguageSwitch && languagePairHref && (
            <div className="px-5 py-3">
              <LanguageSwitchLinks
                isEnglishPage={isEnglishPage}
                jaHref={isEnglishPage ? languagePairHref : location}
                enHref={isEnglishPage ? location : languagePairHref}
              />
            </div>
          )}
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        // 上余白は CSS（`.site-main`）で持つ。インラインで書くと、ヘッダーを
        // 透かしたとき「全画面HEROだけ header の下まで伸ばす」上書きが効かない
        // （インラインは常に勝つ）。
        className="outline-none site-main"
      >
        {children}
      </main>

      <footer
        className="pt-[calc(3rem*var(--spacing-footer-top,1))] footer-reveal"
        ref={footerRef}
        data-footer-layout={footerLayout}
        style={{ paddingBottom: "calc(2rem + var(--sai-bottom))" }}
      >
        <div
          className={`max-w-5xl mx-auto px-6 md:px-12 flex gap-4 min-w-0 ${
            footerLayout === "split"
              ? "flex-col items-start md:flex-row md:items-center md:justify-between"
              : footerLayout === "left"
                ? "flex-col items-start"
                : "flex-col items-center"
          }`}
        >
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
                  className="tap-target font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
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
                  className="tap-target font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
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
                  className="tap-target font-en text-[length:var(--text-small)] tracking-[0.06em] nav-link-luxury footer-link-public py-2"
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
              className="font-en tracking-[0.06em] nav-link-luxury footer-link-public break-words max-w-full"
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
          <div
            className={`flex flex-col gap-2 min-w-0 max-w-full ${
              footerLayout === "center"
                ? "items-center"
                : footerLayout === "split"
                  ? "items-start md:items-end"
                  : "items-start"
            }`}
          >
            <p
              className={`break-words max-w-full ${footerLayout === "center" ? "font-en text-center" : "font-en"}`}
              style={{
                fontSize: "var(--footer-size, 11px)",
                letterSpacing: "0.04em",
                color: `rgba(var(--foreground-rgb), var(--footer-opacity, 0.20))`,
              }}
            >
              {data?.footerText || `© ${new Date().getFullYear()} ${siteNameJa}`}
            </p>
            {data?.templateCreditLabel &&
              (templateCreditUrl ? (
                <a
                  href={templateCreditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en tracking-[0.05em] nav-link-luxury footer-link-public break-words max-w-full"
                  style={
                    {
                      fontSize:
                        "max(8px, calc(var(--footer-size, 11px) - 2px))",
                      "--link-rest": "var(--footer-opacity, 0.13)",
                    } as React.CSSProperties
                  }
                >
                  {data.templateCreditLabel}
                </a>
              ) : (
                <span
                  className={`font-en tracking-[0.05em] break-words max-w-full ${footerLayout === "center" ? "text-center" : ""}`}
                  style={{
                    fontSize:
                      "max(8px, calc(var(--footer-size, 11px) - 2px))",
                    color: `rgba(var(--foreground-rgb), var(--footer-opacity, 0.13))`,
                  }}
                >
                  {data.templateCreditLabel}
                </span>
              ))}
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
