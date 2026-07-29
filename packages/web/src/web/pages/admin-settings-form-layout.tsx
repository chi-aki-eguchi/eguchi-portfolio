import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

export type AdminSettingsSectionItem = {
  id: string;
  label: string;
  summary: string;
  changed: boolean;
  failed: boolean;
};

export type AdminSettingsFormCopy = {
  navigationLabel: string;
  currentSection: string;
  switchSection: string;
  closeSectionList: string;
  changed: string;
  failed: string;
  noChanges: string;
  unsavedCount: (count: number) => string;
  changedSections: (labels: string) => string;
  saving: string;
  save: string;
  discard: string;
  saveFailed: string;
  goToFailed: string;
  savedAt: (time: string) => string;
};

function SectionMarkers({
  item,
  copy,
}: {
  item: AdminSettingsSectionItem;
  copy: AdminSettingsFormCopy;
}) {
  return (
    <span className="admin-form-toc__markers" aria-label={
      item.failed ? copy.failed : item.changed ? copy.changed : undefined
    }>
      {item.changed && (
        <span
          className="admin-form-toc__dot admin-form-toc__dot--changed"
          data-settings-section-changed
          aria-hidden="true"
        />
      )}
      {item.failed && (
        <span
          className="admin-form-toc__dot admin-form-toc__dot--failed"
          data-settings-section-failed
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export function AdminSettingsFormLayout({
  sections,
  changedCount,
  pending,
  saveError,
  lastSavedAt,
  onSave,
  onDiscard,
  copy,
  children,
}: {
  sections: AdminSettingsSectionItem[];
  changedCount: number;
  pending: boolean;
  saveError: boolean;
  lastSavedAt: string | null;
  onSave: () => void;
  onDiscard: () => void;
  copy: AdminSettingsFormCopy;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const changedSections = sections.filter((section) => section.changed);
  const failedSection = sections.find((section) => section.failed);
  const activeSection =
    sections.find((section) => section.id === activeId) ?? sections[0];

  useEffect(() => {
    if (sections.some((section) => section.id === activeId)) return;
    setActiveId(sections[0]?.id ?? "");
  }, [activeId, sections]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const updateActiveSection = () => {
      const threshold = root.getBoundingClientRect().top + 92;
      let nextId = sections[0]?.id ?? "";
      for (const section of sections) {
        const element = document.getElementById(`settings-section-${section.id}`);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= threshold) {
          nextId = section.id;
        } else {
          break;
        }
      }
      setActiveId((current) => (current === nextId ? current : nextId));
    };
    updateActiveSection();
    root.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      root.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [sections]);

  useEffect(() => {
    if (!mobileListOpen) return;
    const firstButton = document.querySelector<HTMLButtonElement>(
      "[data-settings-mobile-section-list] button",
    );
    firstButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileListOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileListOpen]);

  const navigateTo = (id: string) => {
    const section = document.getElementById(`settings-section-${id}`);
    if (!section) return;
    setActiveId(id);
    setMobileListOpen(false);
    section.scrollIntoView({ block: "start", behavior: "smooth" });
    window.setTimeout(() => {
      section
        .querySelector<HTMLButtonElement>(".admin-plain-section-trigger")
        ?.focus({ preventScroll: true });
    }, 180);
  };

  const navigation = (
    <nav aria-label={copy.navigationLabel} className="admin-form-toc__nav">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          data-settings-section-link={section.id}
          aria-current={section.id === activeId ? "location" : undefined}
          className={section.id === activeId ? "is-active" : undefined}
          onClick={() => navigateTo(section.id)}
        >
          <span className="admin-form-toc__label">{section.label}</span>
          <SectionMarkers item={section} copy={copy} />
        </button>
      ))}
    </nav>
  );

  return (
    <div
      ref={scrollRef}
      className="admin-settings-form-layout"
      data-admin-form-layout="settings"
    >
      <div className="admin-settings-mobile-current">
        <span className="admin-settings-mobile-current__label">
          <span>{copy.currentSection}</span>
          <strong>{activeSection?.label}</strong>
        </span>
        <span className="admin-settings-mobile-current__alerts" aria-live="polite">
          {changedSections.length > 0 && (
            <span
              className="admin-form-toc__dot admin-form-toc__dot--changed"
              title={copy.changed}
            />
          )}
          {failedSection && (
            <span
              className="admin-form-toc__dot admin-form-toc__dot--failed"
              title={copy.failed}
            />
          )}
        </span>
        <button
          type="button"
          aria-expanded={mobileListOpen}
          onClick={() => setMobileListOpen(true)}
        >
          {copy.switchSection}
          <ChevronDown size={13} />
        </button>
      </div>

      <div className="admin-settings-form-layout__inner">
        <aside className="admin-form-toc">
          {navigation}
          <output
            className="admin-form-save-panel"
            data-settings-save-panel
            aria-live="polite"
          >
            {saveError ? (
              <>
                <span className="admin-form-save-panel__status is-error">
                  <span className="admin-form-toc__dot admin-form-toc__dot--failed" />
                  {copy.saveFailed}
                </span>
                {failedSection && (
                  <button
                    type="button"
                    className="admin-form-save-panel__error-link"
                    onClick={() => navigateTo(failedSection.id)}
                  >
                    {copy.goToFailed}
                  </button>
                )}
              </>
            ) : changedCount > 0 ? (
              <>
                <strong>{copy.unsavedCount(changedCount)}</strong>
                <span>
                  {copy.changedSections(
                    changedSections.map((section) => section.label).join(" / "),
                  )}
                </span>
              </>
            ) : lastSavedAt ? (
              <span className="admin-form-save-panel__status is-saved">
                <Check size={13} />
                {copy.savedAt(lastSavedAt)}
              </span>
            ) : (
              <span>{copy.noChanges}</span>
            )}

            {changedCount > 0 && (
              <span className="admin-form-save-panel__actions">
                <button type="button" onClick={onDiscard} disabled={pending}>
                  <X size={13} />
                  {copy.discard}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={pending}
                  className="admin-form-save-panel__primary"
                >
                  {pending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  {pending ? copy.saving : copy.save}
                </button>
              </span>
            )}
          </output>
        </aside>

        <main className="admin-settings-form-layout__body">{children}</main>
      </div>

      {mobileListOpen && (
        <dialog
          open
          className="admin-settings-section-sheet"
          aria-modal="true"
          aria-label={copy.navigationLabel}
          data-settings-mobile-section-list
        >
          <div className="admin-settings-section-sheet__header">
            <strong>{copy.navigationLabel}</strong>
            <button
              type="button"
              aria-label={copy.closeSectionList}
              onClick={() => setMobileListOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="admin-settings-section-sheet__list">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-current={section.id === activeId ? "location" : undefined}
                onClick={() => navigateTo(section.id)}
              >
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.summary}</small>
                </span>
                <span className="admin-settings-section-sheet__state">
                  {section.changed && <em>{copy.changed}</em>}
                  {section.failed && <em className="is-error">{copy.failed}</em>}
                </span>
              </button>
            ))}
          </div>
        </dialog>
      )}
    </div>
  );
}
