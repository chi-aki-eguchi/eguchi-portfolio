import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import "./mobile-gallery-filters.css";

type Medium = "all" | "film" | "digital";

export function MobileGalleryFilters({
  categories, activeCategory, activeMedium, hasMedium, count, loading, failed, onChange,
}: {
  categories: { slug: string; label: string }[];
  activeCategory: string;
  activeMedium: Medium;
  hasMedium: boolean;
  count: number;
  loading: boolean;
  failed: boolean;
  onChange: (next: { c?: string; medium?: Medium }) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = [
    activeCategory !== "all" ? categories.find(c => c.slug === activeCategory)?.label : null,
    activeMedium === "film" ? "Film" : activeMedium === "digital" ? "Digital" : null,
  ].filter(Boolean);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const media = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previous;
      media.removeEventListener("change", onResize);
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className="gallery-mobile-filters">
      <div className="gallery-mobile-filters__bar">
        <span aria-live="polite">{loading ? "読み込み中" : failed ? "読み込めませんでした" : `${count} 点`}</span>
        {(categories.length > 1 || hasMedium) && (
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open}
            aria-haspopup="dialog" aria-controls="gallery-filter-dialog">
            <SlidersHorizontal size={15} aria-hidden="true" />
            絞り込み{selected.length > 0 && <span className="gallery-mobile-filters__badge">{selected.length}</span>}
          </button>
        )}
      </div>
      {selected.length > 0 && <div className="gallery-mobile-filters__selection">
        <span>{selected.join(" / ")}</span>
        <button type="button" onClick={() => onChange({ c: "all", medium: "all" })}>解除</button>
      </div>}
      {/* The native dialog handles Escape and focus; this pointer handler only dismisses its backdrop. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      {open && <dialog id="gallery-filter-dialog" ref={dialogRef} className="gallery-filter-dialog"
        aria-labelledby="gallery-filter-title"
        onCancel={event => { event.preventDefault(); setOpen(false); }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right) setOpen(false);
        }}>
        <header><h2 id="gallery-filter-title">写真を絞り込む</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="絞り込みを閉じる"><X size={20} /></button>
        </header>
        <div className="gallery-filter-dialog__body">
          {categories.length > 1 && <fieldset><legend>カテゴリー</legend><div>
            {categories.map(category => <button type="button" key={category.slug}
              aria-pressed={activeCategory === category.slug} onClick={() => onChange({ c: category.slug })}>{category.label}</button>)}
          </div></fieldset>}
          {hasMedium && <fieldset><legend>撮影方式</legend><div>
            {([ ["all", "すべて"], ["film", "Film"], ["digital", "Digital"] ] as const).map(([value, label]) =>
              <button type="button" key={value} aria-pressed={activeMedium === value}
                onClick={() => onChange({ medium: value })}>{label}</button>)}
          </div></fieldset>}
        </div>
        <footer>
          <button type="button" disabled={selected.length === 0} onClick={() => onChange({ c: "all", medium: "all" })}>すべて解除</button>
          <button type="button" className="gallery-filter-dialog__apply" onClick={() => setOpen(false)}>{count} 点の写真を見る</button>
        </footer>
      </dialog>}
    </div>
  );
}
