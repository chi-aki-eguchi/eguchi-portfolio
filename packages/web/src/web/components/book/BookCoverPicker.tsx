import { srcFor } from "../../lib/picture";
import { pad2 } from "../../lib/book";
import { useBookChapters } from "./useBookChapters";

/**
 * 管理画面「写真集のトップの写真」。公開中の作品の写真を、作品ページと
 * 同じ順・同じ番号で並べて1枚選ぶ。空（自動）に戻せる。
 * 公開サイトと同じ一覧を読むので、選べるのは公開中の写真だけ。
 */
export function BookCoverPicker({
  value,
  onChange,
  autoLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  autoLabel: string;
}) {
  const { chapters, isLoading } = useBookChapters();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-pressed={value === ""}
        onClick={() => onChange("")}
        className={`self-start text-[length:var(--admin-text-note)] leading-tight px-3 py-1.5 rounded-sm transition-colors ${
          value === ""
            ? "admin-btn-primary font-medium"
            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
        }`}
      >
        {autoLabel}
      </button>
      {isLoading && chapters.length === 0 && (
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">…</p>
      )}
      {chapters.map((chapter) => (
        <div key={chapter.slug} className="flex flex-col gap-1.5">
          <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
            {chapter.title}
          </p>
          <div className="grid grid-cols-6 gap-1 max-h-60 overflow-y-auto pr-1">
            {chapter.photos.map((photo, i) => {
              const selected = value === String(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${chapter.title} ${pad2(i + 1)}`}
                  onClick={() => onChange(String(photo.id))}
                  className={`relative aspect-square overflow-hidden rounded-sm bg-[var(--admin-paper-soft)] ${
                    selected
                      ? "ring-2 ring-[var(--admin-ink)] ring-offset-1"
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <img
                    src={photo.thumbUrl ?? srcFor(photo.url, 200, 70, undefined, photo.rotationDeg)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
