import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  SITE_OUTLINE,
  type SiteOutlineTab,
  type SiteSkeleton,
} from "../../pages/admin-settings-navigation";
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

export type SitePanel =
  | { kind: "settings"; section: string }
  | { kind: "tab"; tab: SiteOutlineTab };

export type SitePanelItem = {
  id: string;
  label: string;
  note?: string;
  /** この骨格を選んでいるときだけ公開サイトに効く */
  only?: SiteSkeleton;
  keywords?: string;
  panel: SitePanel;
};

const ONLY_LABEL: Record<SiteSkeleton, string> = {
  book: "写真中心のとき",
  classic: "いつもの構成のとき",
};

/**
 * 管理画面「サイト」の目次。正本は `SITE_OUTLINE`（公開サイトのページ順）。
 * 骨格を切り替えても項目は動かさず、使わない項目には札を付けて薄くするだけにする
 * （2026-09-29 オーナー「骨格を変えたら admin も全部変わってわからない」）。
 */
export function siteOutlineGroups(showService: boolean): { label: string; items: SitePanelItem[] }[] {
  return SITE_OUTLINE.map((group) => ({
    label: group.ja,
    items: group.items
      .filter((item) => showService || !item.service)
      .map((item) => ({
        id: `${item.kind}:${item.id}`,
        label: item.ja,
        note: item.noteJa,
        only: item.only,
        keywords: item.keywords,
        panel:
          item.kind === "settings"
            ? { kind: "settings" as const, section: item.id }
            : { kind: "tab" as const, tab: item.id },
      })),
  })).filter((group) => group.items.length > 0);
}

export function BookSiteView({
  groups,
  active,
  onSelect,
  skeleton,
  changedSections = [],
  showPanel,
  onShowPanel,
  children,
}: {
  groups: { label: string; items: SitePanelItem[] }[];
  active: string;
  onSelect: (item: SitePanelItem) => void;
  /** 公開サイトで今使っている骨格（保存済みの値） */
  skeleton: SiteSkeleton;
  /** 保存していない変更がある設定の節 */
  changedSections?: readonly string[];
  /**
   * スマホで中身（true）と目次（false）のどちらを出すか。スマホは目次と中身を1画面ずつ
   * 出す。目次の下に中身を積むと、項目を押しても何も変わらないように見えた（長い目次の
   * 下までスクロールしないと中身が見えない）。PC は両方並ぶので見た目は変わらない。
   */
  showPanel: boolean;
  onShowPanel: (show: boolean) => void;
  children: ReactNode;
}) {
  // 目次の中を言葉で探す（「メール」「フォント」「並び順」など）。項目名・一言・関連語から。
  const [query, setQuery] = useState("");
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = (item: SitePanelItem) => {
    const haystack = `${item.label} ${item.note ?? ""} ${item.keywords ?? ""}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  };
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0);
  const open = (item: SitePanelItem) => onSelect(item);
  const activeItem = groups.flatMap((g) => g.items).find((item) => item.id === active);
  return (
    <div className="book-site" data-mobile={showPanel ? "panel" : "toc"}>
      <nav className="book-site__toc" aria-label="サイトの設定">
        <p className="book-site__lede">
          公開サイトのどこが変わるかの順に並べています。
          {skeleton === "book" ? "今は「写真中心」です。" : "今は「いつもの構成」です。"}
        </p>
        <div className="book-site__search">
          <input
            type="search"
            className="bench-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = shown[0]?.items[0];
              if (e.key === "Enter" && first) {
                e.preventDefault();
                open(first);
              }
            }}
            aria-label="設定を探す"
            placeholder="設定を探す（メール・書体…）"
          />
        </div>
        {shown.length === 0 && (
          <output className="book-site__empty">
            「{query.trim()}」に当たる設定は見つかりませんでした。
          </output>
        )}
        {shown.map((g) => (
          <div key={g.label} className="book-site__group">
            <p className="book-site__group-label">{g.label}</p>
            <ul>
              {g.items.map((item) => {
                const inactive = item.only !== undefined && item.only !== skeleton;
                const changed =
                  item.panel.kind === "settings" && changedSections.includes(item.panel.section);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="bk-ax-btn book-site__item"
                      aria-current={active === item.id ? "page" : undefined}
                      data-site-item={item.id}
                      data-skeleton-inactive={inactive || undefined}
                      title={inactive ? "今の骨格では公開サイトに使われていません（値は残ります）" : undefined}
                      onClick={() => open(item)}
                    >
                      <span className="book-site__item-label">
                        {item.label}
                        {changed && (
                          <span className="book-site__changed" data-settings-section-changed>
                            <span className="sr-only">（保存していない変更があります）</span>
                          </span>
                        )}
                        {item.only && (
                          <em className="book-site__only">
                            {ONLY_LABEL[item.only]}
                            {inactive && <span className="sr-only">（今は使われていません）</span>}
                          </em>
                        )}
                      </span>
                      {item.note && <small>{item.note}</small>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="book-site__note">
          「写真中心のとき」「いつもの構成のとき」と書いた項目は、その骨格を選んでいるときだけ公開サイトに効きます。
          骨格を切り替えても値は残り、この目次も管理画面の形も変わりません。
        </p>
      </nav>
      <div className="book-site__panel">
        <button
          type="button"
          className="bk-ax-btn book-site__back"
          onClick={() => onShowPanel(false)}
        >
          ← サイトの一覧
          {activeItem && <span>{activeItem.label}</span>}
        </button>
        {children}
      </div>
    </div>
  );
}
