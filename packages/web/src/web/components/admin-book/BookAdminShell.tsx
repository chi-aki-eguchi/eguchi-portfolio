import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./admin-book.css";

/**
 * 管理画面の入口（2026-09-26 作り直し）。`library` は従来の写真の一覧
 * （構図・日付の一括入力などの詳しい道具）で、上の入口には出さず、
 * 右の欄の「構図・詳しい道具」と ⌘K から開く。
 */
export type BookAdminView = "photos" | "series" | "site" | "library";

/** 保存されていた古い入口の名前を、今の入口へ読み替える。 */
export function normalizeBookView(v: string | null | undefined): BookAdminView {
  if (v === "series" || v === "site" || v === "library" || v === "photos") return v;
  return "photos";
}

/**
 * 管理画面の器（2026-09-23 試作、2026-09-26 作り直し）。
 *
 * 2026-09-29 から、サイトの骨格（写真中心／いつもの構成）に関係なく、管理画面は
 * いつもこの形。以前は骨格を切り替えると管理画面ごと別物（左の縦メニューの黒い画面）
 * に入れ替わり、オーナーが「何がどこにあるのか分からない」と困った。
 *
 * 上に3つの入口だけを置く。
 *   写真     — すべての写真（ふだんの仕事はここで終わる）
 *   シリーズ — 写真をまとめて見せる入れ物（1枚を何本にも入れられる）
 *   サイト   — 公開サイトのページ順に並べた設定（トップ・写真・About・見た目…）
 * 設定や移動先は ⌘K の「探す」からも開ける。
 */
export function BookAdminShell({
  pdfEnabled,
  siteName,
  view,
  onView,
  onSearch,
  siteHref,
  onLogout,
  locked,
  banner,
  children,
  overlays,
  theme,
  onToggleTheme,
  languageToggle,
}: {
  pdfEnabled?: boolean;
  siteName: string;
  view: BookAdminView;
  onView: (view: BookAdminView) => void;
  onSearch: () => void;
  siteHref: string;
  onLogout: () => void;
  /** 取り込み中・並べ替え中は入口を切り替えない。 */
  locked?: boolean;
  banner?: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
  /** 管理画面の明暗（写真の色を見るため、暗い部屋でも使えるように）。 */
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** 管理画面の言葉（JP / EN）の切り替え。体験版は上の帯に置くので渡さない */
  languageToggle?: ReactNode;
}) {
  const tabs: { id: BookAdminView; label: string; hint: string }[] = [
    { id: "photos", label: "写真", hint: "写真を加える・公開・シリーズへ入れる・並び" },
    { id: "series", label: "シリーズ", hint: "シリーズの言葉・写真の並び・表紙" },
    { id: "site", label: "サイト", hint: "トップ・About・Contact・見た目・名前" },
  ];
  const current = view === "library" ? "photos" : view;
  // スマホは右上の「メニュー」に道具をしまい、上の帯を2行（名前・入口）に収める。
  // 道具を並べたままだと 320px 幅で5行になり、写真の編集欄が 77px まで潰れた（2026-09-29）。
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolsId = useId();
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const root = menuRef.current;
      if (root && !root.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  return (
    <div className="admin-book" data-view={view}>
      {banner}
      <header className="admin-book__bar">
        <p className="admin-book__name font-ja">
          {siteName}
          <span className="admin-book__name-sub">の管理</span>
        </p>
        <nav className="admin-book__tabs" aria-label="管理画面の入口">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="bk-ax-btn admin-book__tab"
              aria-current={current === t.id ? "page" : undefined}
              disabled={locked && current !== t.id}
              onClick={() => onView(t.id)}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="admin-book__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="bk-ax-btn admin-book__menu"
          aria-expanded={menuOpen}
          aria-controls={toolsId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          メニュー
        </button>
        <div
          id={toolsId}
          className="admin-book__tools"
          data-open={menuOpen || undefined}
        >
          {/* 道具を1つ押したら閉じる（言葉の切り替えは続けて見比べられるよう開いたまま）。 */}
          {pdfEnabled && !locked && <a className="admin-book__tool" href="/admin/pdf" target="_blank" rel="noopener" onClick={closeMenu}>PDF作品集</a>}
          <button type="button" className="bk-ax-btn admin-book__tool" onClick={() => { closeMenu(); onSearch(); }}>
            探す <kbd>⌘K</kbd>
          </button>
          <button type="button" className="bk-ax-btn admin-book__tool" onClick={() => { closeMenu(); onToggleTheme(); }} aria-pressed={theme === "dark"}>
            {theme === "dark" ? "明るい表示" : "暗い表示"}
          </button>
          <a className="admin-book__tool" href={siteHref} target="_blank" rel="noopener" onClick={closeMenu}>
            サイトを見る ↗
          </a>
          <button type="button" className="bk-ax-btn admin-book__tool admin-book__tool--quiet" onClick={() => { closeMenu(); onLogout(); }}>
            ログアウト
          </button>
          {languageToggle && <div className="admin-book__lang">{languageToggle}</div>}
        </div>
        </div>
      </header>
      <main className="admin-book__main">{children}</main>
      {overlays}
    </div>
  );
}
