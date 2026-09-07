import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Dock beside the contact sheet when there is space; use the native top layer on touch widths. */
export function LibraryFilterPanel({ title, closeLabel, resultsLabel, clearLabel, active, onClose, onClear, children }: {
  title: string;
  closeLabel: string;
  resultsLabel: string;
  clearLabel: string;
  active: boolean;
  onClose: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  const [docked, setDocked] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.querySelector<HTMLButtonElement>("[data-library-filters-toggle]");
    const media = window.matchMedia("(min-width: 1100px)");
    const resize = () => setDocked(media.matches);
    media.addEventListener("change", resize);
    return () => {
      media.removeEventListener("change", resize);
      requestAnimationFrame(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
    };
  }, []);
  useEffect(() => {
    if (docked) {
      panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      const escape = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.key !== "Escape" || document.querySelector("dialog[open]")) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      };
      window.addEventListener("keydown", escape, true);
      return () => window.removeEventListener("keydown", escape, true);
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const backdrop = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current();
    };
    const tabLoop = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), summary, input:not(:disabled)")].filter(control => {
        const closed = control.closest("details:not([open])");
        return control.getClientRects().length > 0 && (!closed || control === closed.querySelector("summary"));
      });
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    };
    dialog.addEventListener("keydown", tabLoop);
    dialog.addEventListener("click", backdrop);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.removeEventListener("keydown", tabLoop);
      dialog.removeEventListener("click", backdrop);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previous;
    };
  }, [docked]);
  const contents = <>
    <header className="admin-filter-header">
      <h2 id="library-filter-title">{title}</h2>
      <button type="button" aria-label={closeLabel} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="admin-filter-body">{children}</div>
    <footer className="admin-filter-footer">
      <button type="button" onClick={onClear} disabled={!active}>{clearLabel}</button>
      <button type="button" className="admin-btn-primary" onClick={onClose}>{resultsLabel}</button>
    </footer>
  </>;
  if (docked) return <aside ref={panelRef} id="library-filter-panel" data-library-filter-sheet
    className="admin-library-filters-panel" aria-labelledby="library-filter-title">{contents}</aside>;
  return <dialog data-phase="show" ref={dialogRef} id="library-filter-panel" data-library-filter-sheet
    className="admin-library-filters-panel admin-library-filters-dialog" aria-labelledby="library-filter-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
>{contents}</dialog>;
}
