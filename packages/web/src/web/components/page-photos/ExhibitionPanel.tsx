import { useEffect, useMemo, useState } from "react";
import { adminPhotoSrc } from "../../pages/admin-shared";
import type { PagePhoto } from "../../lib/page-photos";
import {
  EXHIBITION_CAPTION_MAX,
  EXHIBITION_DATES_MAX,
  EXHIBITION_TEXT_MAX,
  EXHIBITION_TITLE_MAX,
  readExhibitionCaptions,
  writeExhibitionCaptions,
} from "../../../shared/exhibition";

/** 欄を出たときに保存する1行（または複数行）の入力。保存された値が変わったら欄を合わせる。 */
function CopyField({
  label,
  value,
  max,
  multiline = false,
  field,
  onSave,
}: {
  label: string;
  value: string;
  max: number;
  multiline?: boolean;
  field: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onSave(draft);
  };
  return (
    <label>
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={draft}
          maxLength={max}
          rows={4}
          data-pp-exhibition={field}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          value={draft}
          maxLength={max}
          data-pp-exhibition={field}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      )}
    </label>
  );
}

/** 展示の題・会期・添える文。欄を出ると、その場で保存される。空にした項目はトップに出ない。 */
export function ExhibitionCopy({
  title,
  dates,
  text,
  onSave,
}: {
  title: string;
  dates: string;
  text: string;
  onSave: (key: "exhibitionTitle" | "exhibitionDates" | "exhibitionText", next: string, message: string) => void;
}) {
  return (
    <div className="pp-exhibition-copy">
      <CopyField
        label="題"
        field="title"
        value={title}
        max={EXHIBITION_TITLE_MAX}
        onSave={(next) => onSave("exhibitionTitle", next, "題を変えました")}
      />
      <CopyField
        label="会期"
        field="dates"
        value={dates}
        max={EXHIBITION_DATES_MAX}
        onSave={(next) => onSave("exhibitionDates", next, "会期を変えました")}
      />
      <CopyField
        label="添える文"
        field="text"
        value={text}
        max={EXHIBITION_TEXT_MAX}
        multiline
        onSave={(next) => onSave("exhibitionText", next, "添える文を変えました")}
      />
    </div>
  );
}

/** 写真ごとの題。ふだんは畳んでおく。空の写真には何も出ない。 */
export function ExhibitionCaptions({
  photos,
  value,
  onSave,
}: {
  /** 展示に出している写真（並びのまま）。 */
  photos: PagePhoto[];
  /** 保存されている値（設定 exhibitionCaptions の文字列）。 */
  value: string;
  onSave: (next: string, message: string) => void;
}) {
  const saved = useMemo(() => readExhibitionCaptions(value), [value]);
  const [draft, setDraft] = useState<Record<number, string>>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const commit = () => {
    const next = writeExhibitionCaptions(draft);
    if (next !== writeExhibitionCaptions(saved)) onSave(next, "写真の題を変えました");
  };
  return (
    <details className="pp-doors">
      <summary>写真ごとの題</summary>
      <div className="pp-captions">
        {photos.map((photo) => (
          <label key={photo.id} data-pp-exhibition-caption={photo.id}>
            <img src={adminPhotoSrc(photo, 160, 70)} alt="" loading="lazy" />
            <input
              type="text"
              value={draft[photo.id] ?? ""}
              maxLength={EXHIBITION_CAPTION_MAX}
              aria-label="写真の題"
              placeholder="（出さない）"
              onChange={(event) => setDraft((d) => ({ ...d, [photo.id]: event.target.value }))}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
