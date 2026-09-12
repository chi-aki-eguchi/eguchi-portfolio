import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Moon, Sun, SunMoon } from "lucide-react";
import type { AdminSurfacePreference } from "../hooks/useAdminSurface";
import { useAdminI18n } from "./admin-i18n";

// 管理画面だけの明暗の選択を、子コンポーネント（モバイル上部バー・PC の細い帯・
// デモバナー）へ配るための context。適用は AdminPageContent が root の
// `data-admin-theme` と `adminThemeFromSettings` で行う。
type AdminSurfaceValue = {
  preference: AdminSurfacePreference;
  resolved: "light" | "dark";
  setPreference: (next: AdminSurfacePreference) => void;
};

const AdminSurfaceContext = createContext<AdminSurfaceValue | null>(null);

export function AdminSurfaceProvider({
  value,
  children,
}: {
  value: AdminSurfaceValue;
  children?: ReactNode;
}) {
  return (
    <AdminSurfaceContext.Provider value={value}>
      {children}
    </AdminSurfaceContext.Provider>
  );
}

export function useAdminSurfaceContext() {
  return useContext(AdminSurfaceContext);
}

const OPTIONS: {
  key: AdminSurfacePreference;
  icon: ReactNode;
  ja: string;
  en: string;
}[] = [
  { key: "light", icon: <Sun size={15} />, ja: "明るい", en: "Light" },
  { key: "dark", icon: <Moon size={15} />, ja: "暗い", en: "Dark" },
  { key: "site", icon: <SunMoon size={15} />, ja: "サイトに合わせる", en: "Match site" },
];

/**
 * 「表示の明るさ」を選ぶ単一の操作（44px 以上）。押すとラベル付きの小さな
 * メニューが開き、明るい / 暗い / サイトに合わせる から選ぶ（現在の選択に印）。
 * 常時3アイコンを並べず、PC でもスマホでも横幅を圧迫しない。公開サイトの
 * テーマ設定とは独立（`useAdminSurface`）。
 *
 * キーボード: `AdminCompactSidebar` の popover と同じ規則（role="menu" +
 * menuitemradio、Arrow/Home/End で移動、Escape で閉じてトリガーへ戻る）。
 */
export function AdminSurfaceToggle({ className = "" }: { className?: string }) {
  const ctx = useAdminSurfaceContext();
  const { language } = useAdminI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = (index: number) => {
    requestAnimationFrame(() => {
      const items = rootRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-surface-item]",
      );
      if (!items?.length) return;
      items[Math.max(0, Math.min(index, items.length - 1))]?.focus();
    });
  };

  const close = (refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  const openMenu = (focusIndex: number) => {
    setOpen(true);
    focusItem(focusIndex);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!ctx) return null;

  const label = language === "ja" ? "表示の明るさ" : "Appearance";
  const activeIndex = OPTIONS.findIndex((o) => o.key === ctx.preference);
  const current = OPTIONS[activeIndex] ?? OPTIONS[1];
  const currentText = language === "ja" ? current.ja : current.en;

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu(Math.max(0, activeIndex));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(OPTIONS.length - 1);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[data-surface-item]",
      ),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      // メニュー外へのフォーカス移動を妨げない。閉じるだけにする。
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      data-admin-surface-toggle
      data-preference={ctx.preference}
      className={`admin-surface-toggle relative inline-flex ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${currentText}`}
        title={label}
        onClick={() => (open ? close(false) : openMenu(Math.max(0, activeIndex)))}
        onKeyDown={onTriggerKeyDown}
        className="admin-surface-toggle__trigger"
      >
        {current.icon}
      </button>
      {open && (
        <div
          role="menu"
          id={menuId}
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className="admin-surface-toggle__menu"
        >
          {OPTIONS.map((option) => {
            const active = ctx.preference === option.key;
            const text = language === "ja" ? option.ja : option.en;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                data-surface-item
                aria-checked={active}
                data-active={active || undefined}
                tabIndex={-1}
                onClick={() => {
                  ctx.setPreference(option.key);
                  close(true);
                }}
                className="admin-surface-toggle__item"
              >
                <span className="admin-surface-toggle__item-icon">{option.icon}</span>
                <span>{text}</span>
                {active && <Check size={13} className="admin-surface-toggle__item-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
