import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { lockPageScroll } from "../../lib/scroll-lock";

export type FrameNavItem = { href: string; label: string };

type DarkMode = { resolved: "light" | "dark"; toggle: () => void } | null | undefined;

function ThemeMark({ dark }: { dark: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" strokeLinecap="round" />
        </>
      ) : (
        <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * 写真中心のサイトの器（ヘッダーとフッター、2026-09-26）。
 *
 * **器は一度だけ、完成した形で現れる。** それまでのナビは、設定・棚の数・
 * 制作サービスの有無・書体が届くたびに項目が足され、横へずれていた
 * （実測: 開いてから 0.7 秒のあいだに 5 回組み替わった。オーナー「チラチラ動く」）。
 * 呼ぶ側が `ready` を渡すまで右側を出さず、揃ったら一度だけ淡く出す。
 * 項目は写真の枚数などで増減させない。
 */
export function PhotoSiteFrame({
  name,
  nameEn,
  navItems,
  isActive,
  ready,
  dark,
  english,
  languageSwitch,
  footer,
  footerLayout,
  children,
}: {
  name: string;
  nameEn?: string | null;
  navItems: FrameNavItem[];
  isActive: (href: string) => boolean;
  ready: boolean;
  dark: DarkMode;
  english: boolean;
  languageSwitch?: React.ReactNode;
  footer: React.ReactNode;
  /** 管理画面「フッターの並べ方」: center / left / split */
  footerLayout?: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // メニューが横に入りきらないときは「Menu」にまとめる（管理画面でメニューの文字を
  // 大きくしたとき・項目が増えたとき・画面が狭いとき）。描く前に測るので、はみ出した
  // 形は一度も見せない。
  const barRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLAnchorElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      const list = listRef.current;
      const name = nameRef.current;
      if (!list || !name) return;
      const style = getComputedStyle(bar);
      const inner = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const needed = name.scrollWidth + list.scrollWidth + 32;
      setCollapsed(needed > inner);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [navItems.length, ready]);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const unlock = lockPageScroll();
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => wide.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  const themeLabel = english
    ? dark?.resolved === "dark"
      ? "Light"
      : "Dark"
    : dark?.resolved === "dark"
      ? "明るく"
      : "暗く";

  return (
    <div className="ps-site" data-site-design="book">
      <a href="#main-content" className="ps-skip">
        {english ? "Skip to content" : "本文へスキップ"}
      </a>
      <header className="ps-header" data-menu-open={menuOpen || undefined}>
        <div
          ref={barRef}
          className="ps-header__bar"
          data-ready={ready || undefined}
          data-collapsed={collapsed || undefined}
        >
          <Link ref={nameRef} to="/" className="ps-name" onClick={() => setMenuOpen(false)}>
            <span className={english ? "ps-name__main font-en" : "ps-name__main font-ja"}>
              {name}
            </span>
            {!english && nameEn && nameEn !== name && <span className="ps-name__en font-en">{nameEn}</span>}
          </Link>
          <nav className="ps-nav" aria-label={english ? "Main" : "メイン"}>
            <ul ref={listRef} className="ps-nav__list" aria-hidden={collapsed || undefined}>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="ps-nav__link font-en"
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {dark && (
                <li>
                  <button
                    type="button"
                    className="ps-nav__link ps-nav__theme font-en"
                    onClick={dark.toggle}
                    aria-label={
                      english
                        ? dark.resolved === "dark"
                          ? "Switch to light mode"
                          : "Switch to dark mode"
                        : dark.resolved === "dark"
                          ? "明るい表示にする"
                          : "暗い表示にする"
                    }
                  >
                    {/* 幅の変わらない印にする。「Dark」「Light」の文字だと、明暗が
                        決まった瞬間に幅が 4px 変わり、左の項目が横へずれていた。 */}
                    <ThemeMark dark={dark.resolved === "dark"} />
                  </button>
                </li>
              )}
              {languageSwitch && <li className="ps-nav__lang">{languageSwitch}</li>}
            </ul>
            <button
              ref={menuButtonRef}
              type="button"
              className="ps-menu-button font-en"
              aria-expanded={menuOpen}
              aria-controls="ps-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </nav>
        </div>
        {menuOpen && (
          <nav id="ps-menu" ref={menuRef} className="ps-menu" aria-label={english ? "Menu" : "メニュー"}>
            <ul>
              <li>
                <Link to="/" className="ps-menu__link font-en" onClick={() => setMenuOpen(false)}>
                  Photographs
                </Link>
              </li>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="ps-menu__link font-en"
                    aria-current={isActive(item.href) ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="ps-menu__foot">
              {dark && (
                <button type="button" className="ps-menu__small font-ja" onClick={dark.toggle}>
                  {themeLabel}
                </button>
              )}
              {languageSwitch}
            </div>
          </nav>
        )}
      </header>
      <main id="main-content" tabIndex={-1} className="ps-main">
        {children}
      </main>
      <footer className="ps-footer" data-layout={footerLayout ?? "center"}>
        {footer}
      </footer>
    </div>
  );
}
