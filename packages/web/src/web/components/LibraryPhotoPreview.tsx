import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function LibraryPhotoPreview({ src, title, closeLabel, previousLabel, nextLabel, onClose, onStep }: {
  src: string; title: string; closeLabel: string; previousLabel: string; nextLabel: string;
  onClose: () => void; onStep?: (direction: -1 | 1) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({ onClose, onStep });
  callbacks.current = { onClose, onStep };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        callbacks.current.onStep?.(event.key === "ArrowLeft" ? -1 : 1);
      } else if (event.code === "Space") {
        event.preventDefault();
        callbacks.current.onClose();
      }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} data-phase="show" className="admin-library-photo-preview" aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>
      <button type="button" onClick={onClose}><X size={18} />{closeLabel}</button>
      {onStep && <div>
        <button type="button" aria-label={previousLabel} onClick={() => onStep(-1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label={nextLabel} onClick={() => onStep(1)}><ChevronRight size={20} /></button>
      </div>}
    </header>
    <img src={src} alt={title} />
    <p>{title}</p>
  </dialog>;
}
