import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, LogOut, X } from "lucide-react";
import {
  ADMIN_TAB_GROUPS,
  groupForTab,
  type AdminTabGroup,
  type Tab,
} from "./admin-shared";
import { AdminLanguageToggle, useAdminI18n } from "./admin-i18n";

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

export function AdminMobileTabBar({
  tab,
  tabMeta,
  tabGroups = ADMIN_TAB_GROUPS,
  galleryUploading,
  onSelectTab,
}: {
  tab: Tab;
  tabMeta: AdminTabMeta;
  tabGroups?: readonly AdminTabGroup[];
  galleryUploading: boolean;
  // requestTab と同じ契約: 未保存ガードで拒否されたら false。
  onSelectTab: (tab: Tab) => boolean;
}) {
  const { t } = useAdminI18n();
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mobileGroups = useMemo(() => tabGroups.map(group => ({
    ...group, tabs: group.tabs.filter(key => key !== "settings"),
  })).filter(group => group.tabs.length > 0), [tabGroups]);
  const activeGroup = groupForTab(tab, mobileGroups);
  const openGroup =
    mobileGroups.find((g) => g.key === openGroupKey) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!openGroupKey || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const media = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (media.matches) setOpenGroupKey(null); };
    media.addEventListener("change", onResize);
    return () => {
      media.removeEventListener("change", onResize);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [openGroupKey]);

  const selectTab = (next: Tab) => {
    // ガードで止められてもシートは閉じる(確認モーダルが前面に出るため)。
    onSelectTab(next);
    setOpenGroupKey(null);
  };
  const groupLabel = (group: AdminTabGroup) => {
    if (group.key === "photos") return t.navigation.groups.photos;
    if (group.key === "presentation") return t.navigation.groups.presentation;
    if (group.key === "site") return t.navigation.groups.site;
    return group.label;
  };

  return (
    <>
      {openGroup && (
        <dialog
          ref={dialogRef}
          className="admin-sheet md:hidden"
          data-phase="show"
          aria-label={t.navigation.groupTabs(groupLabel(openGroup))}
          onCancel={(event) => { event.preventDefault(); setOpenGroupKey(null); }}
        >
          {/* `absolute` はグローバル button リセット(:not(.absolute))の除外用 */}
          <button
            type="button"
            aria-label={t.common.close}
            className="admin-sheet__backdrop absolute"
            onClick={() => setOpenGroupKey(null)}
          />
          <div className="admin-sheet__panel">
            <div className="admin-sheet__head">
              <span>{groupLabel(openGroup)}</span>
              <button
                type="button"
                aria-label={t.navigation.closeSheet}
                className="admin-tap text-[var(--admin-muted)]"
                onClick={() => setOpenGroupKey(null)}
              >
                <X size={16} />
              </button>
            </div>
            {openGroup.tabs.map((key) => (
              <button
                key={key}
                type="button"
                disabled={galleryUploading && key !== "gallery"}
                aria-current={tab === key ? "page" : undefined}
                data-active={tab === key || undefined}
                className="admin-sheet__row"
                onClick={() => selectTab(key)}
              >
                {tabMeta[key].icon}
                <span>{tabMeta[key].label}</span>
              </button>
            ))}
          </div>
        </dialog>
      )}
      <nav
        className="admin-bottom-nav md:hidden"
        aria-label={t.navigation.label}
      >
        {mobileGroups.map((group) => {
          const active = tab !== "settings" && group.key === activeGroup.key;
          const single = group.tabs.length === 1;
          return (
            <button
              key={group.key}
              type="button"
              disabled={galleryUploading && !group.tabs.includes("gallery")}
              aria-expanded={single ? undefined : openGroupKey === group.key}
              data-active={active || undefined}
              className="admin-bottom-nav__btn"
              onClick={() => {
                if (single) {
                  selectTab(group.tabs[0]);
                } else {
                  setOpenGroupKey((k) => (k === group.key ? null : group.key));
                }
              }}
            >
              <span className="admin-bottom-nav__label">
                {groupLabel(group)}
              </span>
              <span className="admin-bottom-nav__sub">
                {active ? tabMeta[tab].label : " "}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          data-admin-mobile-settings
          disabled={galleryUploading}
          aria-current={tab === "settings" ? "page" : undefined}
          data-active={tab === "settings" || undefined}
          className="admin-bottom-nav__btn"
          onClick={() => selectTab("settings")}
        >
          <span className="admin-bottom-nav__label">{t.navigation.settingsButton}</span>
          <span className="admin-bottom-nav__sub">{tab === "settings" ? tabMeta.settings.label : " "}</span>
        </button>
      </nav>
    </>
  );
}
