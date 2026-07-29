import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ChevronRight,
  ExternalLink,
  Grid,
  Image as ImageIcon,
  LogOut,
  Settings,
} from "lucide-react";
import type { AdminTabGroup, Tab } from "./admin-shared";

const GROUP_ICONS: Record<string, ReactNode> = {
  photos: <ImageIcon size={20} />,
  presentation: <Grid size={20} />,
  site: <Settings size={20} />,
};

export function AdminCompactSidebar({
  groups,
  tabMeta,
  activeTab,
  navigationLocked,
  onRequestTab,
  onExpand,
  onLogout,
  labels,
}: {
  groups: readonly AdminTabGroup[];
  tabMeta: Record<Tab, { label: string; icon: ReactNode }>;
  activeTab: Tab;
  navigationLocked: boolean;
  onRequestTab: (tab: Tab) => boolean;
  onExpand: () => void;
  onLogout: () => void;
  labels: {
    navigation: string;
    expand: string;
    openSite: string;
    logout: string;
  };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const groupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!openGroup) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [openGroup]);

  useEffect(() => setOpenGroup(null), [activeTab]);

  const focusPopoverItem = (groupKey: string, index: number) => {
    requestAnimationFrame(() => {
      const items = rootRef.current?.querySelectorAll<HTMLButtonElement>(
        `[data-compact-sidebar-popover="${groupKey}"] [data-compact-sidebar-item]`,
      );
      if (!items?.length) return;
      items[Math.max(0, Math.min(index, items.length - 1))]?.focus();
    });
  };

  const openAndFocus = (group: AdminTabGroup, index = 0) => {
    if (group.tabs.length === 1) {
      onRequestTab(group.tabs[0]);
      return;
    }
    setOpenGroup(group.key);
    focusPopoverItem(group.key, index);
  };

  const handlePopoverKeys = (
    event: KeyboardEvent<HTMLDivElement>,
    group: AdminTabGroup,
  ) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[data-compact-sidebar-item]",
      ),
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.preventDefault();
      setOpenGroup(null);
      groupButtonRefs.current[group.key]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="admin-sidebar-compact">
      <button
        type="button"
        data-compact-sidebar-expand
        onClick={onExpand}
        aria-label={labels.expand}
        className="admin-sidebar-compact__expand"
      >
        <ChevronRight size={18} />
      </button>

      <nav
        className="admin-sidebar-compact__groups"
        aria-label={labels.navigation}
      >
        {groups.map((group) => {
          const active = group.tabs.includes(activeTab);
          const disabled =
            navigationLocked && !group.tabs.includes("gallery");
          const expanded = openGroup === group.key;
          return (
            <div key={group.key} className="admin-sidebar-compact__group">
              <button
                ref={(element) => {
                  groupButtonRefs.current[group.key] = element;
                }}
                type="button"
                data-compact-sidebar-group={group.key}
                data-active={active || undefined}
                aria-expanded={
                  group.tabs.length > 1 ? expanded : undefined
                }
                aria-haspopup={group.tabs.length > 1 ? "menu" : undefined}
                disabled={disabled}
                onClick={() => {
                  if (group.tabs.length === 1) {
                    onRequestTab(group.tabs[0]);
                    return;
                  }
                  setOpenGroup((current) =>
                    current === group.key ? null : group.key,
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "ArrowRight" ||
                    event.key === "ArrowDown" ||
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    openAndFocus(group);
                  }
                }}
                className="admin-sidebar-compact__group-button"
              >
                {GROUP_ICONS[group.key] ?? tabMeta[group.tabs[0]].icon}
                <span>{group.label}</span>
              </button>

              {expanded && group.tabs.length > 1 && (
                <div
                  role="menu"
                  tabIndex={-1}
                  aria-label={group.label}
                  data-compact-sidebar-popover={group.key}
                  className="admin-sidebar-compact__popover"
                  onKeyDown={(event) => handlePopoverKeys(event, group)}
                >
                  {group.tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="menuitem"
                      data-compact-sidebar-item
                      data-active={activeTab === tab || undefined}
                      disabled={navigationLocked && tab !== "gallery"}
                      onClick={() => {
                        if (onRequestTab(tab)) setOpenGroup(null);
                      }}
                    >
                      {tabMeta[tab].icon}
                      <span>{tabMeta[tab].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="admin-sidebar-compact__footer">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          aria-label={labels.openSite}
        >
          <ExternalLink size={18} />
        </a>
        <button type="button" onClick={onLogout} aria-label={labels.logout}>
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
