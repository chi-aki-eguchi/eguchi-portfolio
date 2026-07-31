import type { ReactNode } from "react";
import { AdminLanguageToggle } from "./admin-i18n";
import { PageTitle } from "./admin-ui";

export function AdminDesktopLanguageBar() {
  return (
    <div className="admin-lang-bar">
      <AdminLanguageToggle className="text-[var(--admin-muted)]" />
    </div>
  );
}

// 全画面共通の見出し。実体は admin-ui.tsx の PageTitle。
// 「タイトル / 説明1つ / 右の操作」という並びを画面ごとに作り直さないための入口。
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageTitle title={title} description={description} actions={actions} />
  );
}

// 見出し右の副操作。黒塗りは使わず、押されている間だけ静かに沈める。
export function PageHeaderButton({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className="ax-btn ax-btn--quiet ax-btn--small"
    >
      {children}
    </button>
  );
}
