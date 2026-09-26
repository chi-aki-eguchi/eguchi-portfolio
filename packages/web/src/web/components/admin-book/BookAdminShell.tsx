import type { ReactNode } from "react";
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
 * 写真中心の管理画面の器（2026-09-23 試作、2026-09-26 作り直し）。
 *
 * 上に3つの入口だけを置く。
 *   写真     — すべての写真（ふだんの仕事はここで終わる）
 *   シリーズ — 写真をまとめて見せる入れ物（1枚を何本にも入れられる）
 *   サイト   — About・Contact・見た目・名前
 * 設定や移動先は ⌘K の「探す」からも開ける。
 */
export function BookAdminShell({
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
}: {
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
}) {
  const tabs: { id: BookAdminView; label: string; hint: string }[] = [
    { id: "photos", label: "写真", hint: "写真を加える・公開・シリーズへ入れる・並び" },
    { id: "series", label: "シリーズ", hint: "シリーズの言葉・写真の並び・表紙" },
    { id: "site", label: "サイト", hint: "About・Contact・見た目・名前" },
  ];
  const current = view === "library" ? "photos" : view;
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
        <div className="admin-book__tools">
          <button type="button" className="bk-ax-btn admin-book__tool" onClick={onSearch}>
            探す <kbd>⌘K</kbd>
          </button>
          <button type="button" className="bk-ax-btn admin-book__tool" onClick={onToggleTheme} aria-pressed={theme === "dark"}>
            {theme === "dark" ? "明るい表示" : "暗い表示"}
          </button>
          <a className="admin-book__tool" href={siteHref} target="_blank" rel="noopener">
            サイトを見る ↗
          </a>
          <button type="button" className="bk-ax-btn admin-book__tool admin-book__tool--quiet" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </header>
      <main className="admin-book__main">{children}</main>
      {overlays}
    </div>
  );
}

export type SitePanel =
  | { kind: "settings"; section: string }
  | { kind: "tab"; tab: "profile" | "pricing" | "service" | "categories" | "setup" };

export type SitePanelItem = { id: string; label: string; note?: string; panel: SitePanel };

/** 写真集の管理画面「サイト」の目次。作品以外のページもここに集める。 */
export function bookSiteGroups(showService: boolean): { label: string; items: SitePanelItem[] }[] {
  const s = (id: string, label: string, note?: string): SitePanelItem => ({
    id: `settings:${id}`,
    label,
    note,
    panel: { kind: "settings", section: id },
  });
  const t = (
    tab: "profile" | "pricing" | "service" | "categories" | "setup",
    label: string,
    note?: string,
  ): SitePanelItem => ({ id: `tab:${tab}`, label, note, panel: { kind: "tab", tab } });
  return [
    {
      label: "サイトの形",
      items: [
        s("page-layout", "サイトの骨格", "写真中心／いつもの構成、About・Contact の組み方"),
        s("series", "シリーズの中の並び", "並べた順か、撮影日の順か"),
      ],
    },
    {
      label: "作品以外のページ",
      items: [
        t("profile", "About（プロフィール）"),
        s("cta", "Contact・撮影のご依頼"),
        s("site-basics", "名前・連絡先・検索"),
        t("pricing", "料金・プラン"),
        ...(showService
          ? [t("service", "ポートフォリオ制作の紹介ページ"), s("portfolio-kit", "ポートフォリオ制作の入口の表示")]
          : []),
      ],
    },
    {
      label: "見た目",
      items: [
        s("theme", "背景と配色"),
        s("fonts", "書体"),
        s("font-size", "文字の大きさ"),
        s("font-spacing", "字間と行間"),
        s("font-color", "文字の色"),
        s("texture", "背景の質感"),
      ],
    },
    {
      label: "そのほか",
      items: [
        s("site-copy", "表示する言葉"),
        t("categories", "分類"),
        s("presets", "カメラ・レンズの候補"),
        s("note", "note の連携"),
        s("print", "プリント販売"),
        t("setup", "はじめに（最初の設定の確認）"),
      ],
    },
  ];
}

/**
 * 写真集では効かない設定の節。値は消さずに残し、目次から外すだけ
 * （いつもの構成へ戻したときにそのまま効く）。
 *   hero           トップの見せ方（5種）— 写真集のトップは別の仕組み
 *   gallery-layout 写真一覧のレイアウト — 写真集のトップと Photos は決まった段組み
 *   navigation     メニューとヘッダー — 写真集は上のメニューに固定
 *   mood           デザインの出発点 — 上の3つをまとめて入れ替えるもの
 *   reveal         写真の表示アニメーション — 写真集の頁では使わない
 *   spacing        ページの余白 — 写真集の縁は写真の大きさから決める
 */
export const BOOK_HIDDEN_SETTINGS = [
  "hero",
  "gallery-layout",
  "navigation",
  "mood",
  "reveal",
  "spacing",
] as const;

export const BOOK_SETTINGS_LABELS: Record<string, string> = {
  "page-layout": "サイトの骨格",
  series: "シリーズの中の並び",
};

export function BookSiteView({
  groups,
  active,
  onSelect,
  children,
}: {
  groups: { label: string; items: SitePanelItem[] }[];
  active: string;
  onSelect: (item: SitePanelItem) => void;
  children: ReactNode;
}) {
  return (
    <div className="book-site">
      <nav className="book-site__toc" aria-label="サイトの設定">
        {groups.map((g) => (
          <div key={g.label} className="book-site__group">
            <p className="book-site__group-label">{g.label}</p>
            <ul>
              {g.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="bk-ax-btn book-site__item"
                    aria-current={active === item.id ? "page" : undefined}
                    onClick={() => onSelect(item)}
                  >
                    <span>{item.label}</span>
                    {item.note && <small>{item.note}</small>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="book-site__note">
          写真中心の構成では使わない設定（トップの見せ方・写真一覧のレイアウト・メニューの位置・動き）は、
          値を残したまま隠しています。「いつもの構成」に戻すと、また出てきます。
        </p>
      </nav>
      <div className="book-site__panel">{children}</div>
    </div>
  );
}
