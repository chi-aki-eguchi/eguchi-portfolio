import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

// 目次で選んだ1節だけを本文へ出すための現在地。目次（左）と本文（右）に
// 同じ節名の一覧が二重に並ぶのをやめ、本文には実際の入力欄だけを置く
// （オーナー確定 2026-07-30）。null = 単節表示ではない画面。
const AdminSettingsActiveSectionContext = createContext<string | null>(null);

export function useAdminSettingsActiveSection(): string | null {
  return useContext(AdminSettingsActiveSectionContext);
}

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
  focusSectionId = null,
  onSave,
  onDiscard,
  copy,
  previewToggle = null,
  mobilePreviewControl = null,
  header = null,
  children,
}: {
  sections: AdminSettingsSectionItem[];
  changedCount: number;
  pending: boolean;
  saveError: boolean;
  lastSavedAt: string | null;
  // 保存に失敗した節など、本文へ強制的に出したい節。目次の選択より優先する。
  focusSectionId?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  copy: AdminSettingsFormCopy;
  // プレビュー開閉。目次の下・保存パネルの上に置き、本文をどこまでスクロール
  // しても sticky な目次の中に残るようにする(仕様 P6 の解消)。
  previewToggle?: ReactNode;
  // 上部 sticky 帯に入れる、狭い幅用の編集/プレビュー切り替え。
  mobilePreviewControl?: ReactNode;
  // ページ見出し。目次の右ではなく、目次と本文の両方の上に置く。
  // 以前は本文の中にあったため、Settings だけ見出しが他タブより 248px 右にずれ、
  // タブを切り替えると見出しが横に飛んでいた。
  header?: ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [navSeq, setNavSeq] = useState(0);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const changedSections = sections.filter((section) => section.changed);
  const failedSection = sections.find((section) => section.failed);
  const activeSection =
    sections.find((section) => section.id === activeId) ?? sections[0];

  useEffect(() => {
    if (sections.some((section) => section.id === activeId)) return;
    setActiveId(sections[0]?.id ?? "");
  }, [activeId, sections]);

  // 保存失敗など、利用者の操作ではない理由で本文を切り替える経路。
  // 目次の現在地もその節へ移し、印と本文が食い違わないようにする。
  useEffect(() => {
    if (!focusSectionId) return;
    if (!sections.some((section) => section.id === focusSectionId)) return;
    setActiveId((current) =>
      current === focusSectionId ? current : focusSectionId,
    );
  }, [focusSectionId, sections]);

  // 目次で節を選んだら本文を先頭へ戻し、見出しへフォーカスを移す。
  // 同じ節を再度押した時も動くよう、activeIdではなく操作回数で発火させる。
  useEffect(() => {
    if (navSeq === 0) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    document
      .querySelector<HTMLElement>(
        `#settings-section-${activeId} [data-settings-section-heading]`,
      )
      ?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSeq]);

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
    setActiveId(id);
    setMobileListOpen(false);
    setNavSeq((seq) => seq + 1);
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
        {mobilePreviewControl}
      </div>

      <div className="admin-settings-form-layout__inner">
        {header && (
          <div className="admin-settings-form-layout__header">{header}</div>
        )}
        <aside className="admin-form-toc">
          {navigation}
          {previewToggle && (
            <div className="admin-form-toc__preview-toggle">{previewToggle}</div>
          )}
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

        <main className="admin-settings-form-layout__body">
          <AdminSettingsActiveSectionContext.Provider value={activeId || null}>
            {children}
          </AdminSettingsActiveSectionContext.Provider>
        </main>
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
                data-settings-sheet-link={section.id}
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
