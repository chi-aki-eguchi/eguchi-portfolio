import type { ReactNode } from "react";

// Common header for all 9 admin screens: title + optional one-line description
// on the left, screen-specific actions on the right. Sits directly on the page
// background — no band/banner. Title font-size is fixed (not `h1`) so it can't
// be re-clamped by the legacy `.admin-content h1` shim rule elsewhere.
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
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1
          className="admin-page-header__title text-[28px] leading-tight m-0"
          style={{
            fontFamily: "var(--admin-font-title)",
            color: "var(--admin-ink)",
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--admin-muted)] max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

// Secondary action button used in PageHeader's actions slot (e.g. "Live
// Preview"): panel surface, no border, radius 8, one step darker on hover.
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
      className={`flex items-center gap-1.5 px-3 py-2 text-[11px] tracking-wide rounded-[var(--radius-s)] transition-colors duration-[var(--dur-fast)] ${
        active
          ? "bg-[color:var(--admin-ink)] text-[color:var(--admin-paper)]"
          : "bg-[color:var(--admin-paper-soft)] text-[color:var(--admin-ink)] hover:bg-[color:var(--admin-paper-deep)]"
      }`}
    >
      {children}
    </button>
  );
}
