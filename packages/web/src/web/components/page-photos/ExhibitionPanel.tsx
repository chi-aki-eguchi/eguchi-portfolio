import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api";
import { adminPhotoSrc, jsonOrThrow } from "../../pages/admin-shared";
import type { PagePhoto } from "../../lib/page-photos";
import {
  EXHIBITION_CAPTION_MAX,
  EXHIBITION_DATES_MAX,
  EXHIBITION_TEXT_MAX,
  EXHIBITION_THANKS_MAX,
  EXHIBITION_TITLE_MAX,
  readExhibitionCaptions,
  writeExhibitionCaptions,
} from "../../../shared/exhibition";

type ExhibitionVisitsData = {
  days: { day: string; people: number; opens: number }[];
  notes: { id: number; message: string; createdAt: string }[];
  noteTotal: number;
};

const noteTime = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

/** 名刺の QR を読んだ数と、届いたひとこと。開いている間は1分ごとに読み直す。 */
export function ExhibitionVisits() {
  const { data, isError } = useQuery({
    queryKey: ["exhibition-visits"],
    queryFn: async (): Promise<ExhibitionVisitsData> => jsonOrThrow(await adminApi["exhibition-visits"].$get()),
    refetchInterval: 60_000,
  });
  if (isError) {
    return <p className="pp-note">QRの数を読めませんでした。1分ほどで読み直します。</p>;
  }
  if (!data) return null;
  const people = data.days.reduce((sum, day) => sum + day.people, 0);
  const opens = data.days.reduce((sum, day) => sum + day.opens, 0);
  return (
    <section className="pp-visits" aria-label="名刺のQRとひとこと">
      <dl className="pp-visits__numbers">
        <div>
          <dt>QRを読んだ人</dt>
          <dd>{people}人</dd>
        </div>
        <div>
          <dt>開かれた回数</dt>
          <dd>{opens}回</dd>
        </div>
        <div>
          <dt>ひとこと</dt>
          <dd>{data.noteTotal}件</dd>
        </div>
      </dl>
      {data.days.length > 1 && (
        <ul className="pp-visits__days">
          {data.days.map((day) => {
            const [, month, date] = day.day.split("-").map(Number);
            return (
              <li key={day.day}>
                {month}月{date}日 {day.people}人
              </li>
            );
          })}
        </ul>
      )}
      {data.notes.length > 0 && (
        <ol className="pp-visits__notes">
          {data.notes.map((note) => (
            <li key={note.id}>
              <time dateTime={note.createdAt}>{noteTime.format(new Date(note.createdAt))}</time>
              <p>{note.message}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

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
          rows={9}
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

/** 展示の題・会期・詩。欄を出ると、その場で保存される。空にした項目はトップに出ない。 */
export function ExhibitionCopy({
  title,
  dates,
  text,
  thanks,
  onSave,
}: {
  title: string;
  dates: string;
  text: string;
  thanks: string;
  onSave: (
    key: "exhibitionTitle" | "exhibitionDates" | "exhibitionText" | "exhibitionThanks",
    next: string,
    message: string,
  ) => void;
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
        label="詩・添える文（写真のあとに、短い文は会場の紙と同じ縦書きで出ます）"
        field="text"
        value={text}
        max={EXHIBITION_TEXT_MAX}
        multiline
        onSave={(next) => onSave("exhibitionText", next, "詩・添える文を変えました")}
      />
      <CopyField
        label="名刺のQRから来た人へのひとこと（空にすると、この部分ごと出ません）"
        field="thanks"
        value={thanks}
        max={EXHIBITION_THANKS_MAX}
        multiline
        onSave={(next) => onSave("exhibitionThanks", next, "ひとことを変えました")}
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
