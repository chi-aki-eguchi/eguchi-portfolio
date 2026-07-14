import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, LogOut, X } from "lucide-react";
import {
  ADMIN_TAB_GROUPS,
  groupForTab,
  type AdminTabGroup,
  type Tab,
} from "./admin-shared";

// スマホ admin ナビ(2026-07-11 モバイル操作性改善)。
// 旧・上部2段横スクロールナビは activeタブが画面外へ流れ、片手の親指で
// 届かない位置にあった。下部固定バー(3グループ)+ボトムシート(タブ一覧)へ
// 置き換える。fixed ではなく admin-main(h-dvh flex)の最下行として置くことで
// z-index・キーボード・safe-area の重なり問題を構造的に避ける。

export type AdminTabMeta = Record<Tab, { label: string; icon: ReactNode }>;

export function AdminMobileTopBar({
  tab,
  tabMeta,
  onLogout,
}: {
  tab: Tab;
  tabMeta: AdminTabMeta;
  onLogout: () => void;
}) {
  const meta = tabMeta[tab];
  return (
    <header className="admin-mobile-topbar lg:hidden">
      <div className="flex items-center gap-2 min-w-0 text-[color:var(--admin-ink)]">
        {meta.icon}
        <span className="text-[13px] tracking-wide truncate">{meta.label}</span>
      </div>
      <div className="flex items-center flex-shrink-0">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          aria-label="公開サイトを開く"
          className="admin-tap flex items-center gap-1 px-2 text-[11px] text-[var(--admin-muted)] transition-colors"
        >
          <ExternalLink size={14} /> Site
        </a>
        <button
          type="button"
          onClick={onLogout}
          aria-label="ログアウト"
          className="admin-tap flex items-center gap-1 px-2 text-[11px] text-[var(--admin-muted)] transition-colors"
        >
          <LogOut size={14} /> Logout
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
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const activeGroup = groupForTab(tab, tabGroups);
  const openGroup =
    tabGroups.find((g) => g.key === openGroupKey) ?? null;

  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroupKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openGroup]);

  const selectTab = (next: Tab) => {
    // ガードで止められてもシートは閉じる(確認モーダルが前面に出るため)。
    onSelectTab(next);
    setOpenGroupKey(null);
  };

  return (
    <>
      {openGroup && (
        <div
          className="admin-sheet lg:hidden"
          aria-label={`${openGroup.label}のタブ`}
        >
          {/* `absolute` はグローバル button リセット(:not(.absolute))の除外用 */}
          <button
            type="button"
            aria-label="閉じる"
            className="admin-sheet__backdrop absolute"
            onClick={() => setOpenGroupKey(null)}
          />
          <div className="admin-sheet__panel">
            <div className="admin-sheet__head">
              <span>{openGroup.label}</span>
              <button
                type="button"
                aria-label="シートを閉じる"
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
        </div>
      )}
      <nav className="admin-bottom-nav lg:hidden" aria-label="管理画面">
        {tabGroups.map((group) => {
          const active = group.key === activeGroup.key;
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
              <span className="admin-bottom-nav__label">{group.label}</span>
              <span className="admin-bottom-nav__sub">
                {active ? tabMeta[tab].label : " "}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
