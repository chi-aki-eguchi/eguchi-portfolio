import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, LogOut, X } from "lucide-react";
import {
  ADMIN_TAB_GROUPS,
  type AdminTabGroup,
  type Tab,
} from "./admin-shared";
import { AdminLanguageToggle, useAdminI18n } from "./admin-i18n";
import { AdminSurfaceToggle } from "./admin-surface";

// スマホ admin ナビ(2026-07-11 モバイル操作性改善)。
// 旧・上部2段横スクロールナビは activeタブが画面外へ流れ、片手の親指で
// 届かない位置にあった。下部バー(3グループ＋設定への直接入口)とタブ一覧へ
// 置き換える。fixed ではなく admin-main(h-dvh flex)の最下行として置くことで
// z-index・キーボード・safe-area の重なり問題を構造的に避ける。

export type AdminTabMeta = Record<Tab, { label: string; icon: ReactNode }>;

export function AdminMobileTopBar({
  tab,
  tabMeta,
  onLogout,
  showLanguageToggle = true,
  siteHref = "/",
}: {
  tab: Tab;
  tabMeta: AdminTabMeta;
  onLogout: () => void;
  showLanguageToggle?: boolean;
  siteHref?: string;
}) {
  const { t } = useAdminI18n();
  const meta = tabMeta[tab];
  return (
    <header className="admin-mobile-topbar md:hidden">
      <div className="flex items-center gap-2 min-w-0 text-[color:var(--admin-ink)]">
        {meta.icon}
        <span className="text-[13px] tracking-wide truncate">{meta.label}</span>
      </div>
      <div className="flex items-center flex-shrink-0">
        <AdminSurfaceToggle className="mr-1 text-[var(--admin-muted)]" />
        {showLanguageToggle && (
          <AdminLanguageToggle className="mr-1 text-[var(--admin-muted)]" />
        )}
        <a
          href={siteHref}
          target="_blank"
          rel="noopener"
          aria-label={t.navigation.openSite}
          className="admin-tap flex items-center gap-1 px-2 text-[11px] text-[var(--admin-muted)] transition-colors"
        >
          <ExternalLink size={14} /> {t.navigation.siteButton}
        </a>
        <button
          type="button"
          onClick={onLogout}
          aria-label={t.navigation.logout}
          className="admin-tap flex items-center gap-1 px-2 text-[11px] text-[var(--admin-muted)] transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export function AdminMobileTabBar({ tab, tabMeta, tabGroups = ADMIN_TAB_GROUPS, galleryUploading, onSelectTab, onSearch }: {
  tab: Tab; tabMeta: AdminTabMeta; tabGroups?: readonly AdminTabGroup[];
  galleryUploading: boolean; onSelectTab: (tab: Tab) => boolean; onSearch?: () => void;
}) {
  const { t, language } = useAdminI18n();
  const ja = language === "ja";
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoTabs: Tab[] = ["gallery", "series", "categories"];
  const isPhotos = photoTabs.includes(tab);
  const available = tabGroups.flatMap(group => group.tabs);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const media = window.matchMedia("(min-width: 768px)");
    const close = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", close);
    return () => {
      media.removeEventListener("change", close);
      dialog.close();
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, [open]);
  const select = (next: Tab) => { onSelectTab(next); setOpen(false); };
  return <>
    {open && <dialog ref={dialogRef} className="admin-sheet md:hidden" data-phase="show"
      aria-label={ja ? "移動先" : "Navigate"} onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <button type="button" aria-label={t.common.close} className="admin-sheet__backdrop absolute" onClick={() => setOpen(false)} />
      <div className="admin-sheet__panel">
        <div className="admin-sheet__head"><span>{ja ? "移動先" : "Navigate"}</span>
          <button type="button" className="admin-tap" aria-label={t.navigation.closeSheet} onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
        {onSearch && <button type="button" className="admin-sheet__row" onClick={() => { setOpen(false); onSearch(); }}>{ja ? "設定・移動先を検索" : "Find a setting or page"}</button>}
        {[{title: ja ? "写真" : "Photographs", tabs: available.filter(key => photoTabs.includes(key))},
          {title: ja ? "サイト編集" : "Site editor", tabs: available.filter(key => !photoTabs.includes(key))}].map(group =>
          <section key={group.title}><h3 className="studio-mobile-nav-heading">{group.title}</h3>
            {group.tabs.map(key => <button key={key} type="button" className="admin-sheet__row"
              disabled={galleryUploading && key !== "gallery"} aria-current={tab === key ? "page" : undefined}
              onClick={() => select(key)}>{tabMeta[key].icon}<span>{tabMeta[key].label}</span></button>)}
          </section>)}
      </div>
    </dialog>}
    <nav className="admin-bottom-nav md:hidden" aria-label={t.navigation.label}>
      <button type="button" data-active={isPhotos || undefined} className="admin-bottom-nav__btn" onClick={() => select("gallery")}>
        <span className="admin-bottom-nav__label">{ja ? "写真" : "Photographs"}</span>
      </button>
      <button type="button" data-admin-mobile-settings disabled={galleryUploading} data-active={!isPhotos || undefined}
        className="admin-bottom-nav__btn" onClick={() => select("settings")}>
        <span className="admin-bottom-nav__label">{ja ? "サイト編集" : "Site editor"}</span>
      </button>
      <button type="button" className="admin-bottom-nav__btn" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="admin-bottom-nav__label">{ja ? "移動" : "Navigate"}</span>
      </button>
    </nav>
  </>;
}
