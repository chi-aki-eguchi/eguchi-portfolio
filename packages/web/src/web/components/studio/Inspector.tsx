import { useEffect, useMemo, useState } from "react";
import { adminPhotoSrc } from "../../pages/admin-shared";
import {
  batch,
  createSeries,
  patchPhoto,
  patchSeries,
  reorderSeriesPhotos,
  seriesPhotos,
  shotLine,
  slugFromTitle,
  trashPhoto,
  restorePhoto,
  useStudio,
  type StudioData,
  type StudioPhoto,
} from "./studio-data";

const FILM = "フィルム";
const DIGITAL = "デジタル";

/**
 * 右の欄。選んだ写真の公開・シリーズ・トップ・言葉・撮影情報をその場で直す。
 * 1枚のときは詳しく、複数のときはまとめて。
 *
 * シリーズは「入れる／外す」のチェック。1枚を何本にも入れられる。
 */
export function Inspector({
  data,
  selection,
  seriesContext,
  onClear,
  onOpenDetails,
}: {
  data: StudioData;
  selection: StudioPhoto[];
  /** シリーズの画面で開いているとき、そのシリーズ（表紙・外すを出す） */
  seriesContext?: number;
  onClear: () => void;
  /** 回転・構図・日付の一括入力など、詳しい道具の画面を開く */
  onOpenDetails?: (photoId: number) => void;
}) {
  if (selection.length === 0) return null;
  return (
    <aside className="st-inspector" aria-label="選んでいる写真">
      <div className="st-inspector__head">
        <p className="st-inspector__count">
          {selection.length === 1 ? "1枚" : `${selection.length}枚を選んでいます`}
        </p>
        <button type="button" className="st-ax-btn st-link" onClick={onClear}>
          選ぶのをやめる
        </button>
      </div>
      {selection.length === 1 ? (
        <Single
          key={selection[0]!.id}
          data={data}
          photo={selection[0]!}
          seriesContext={seriesContext}
          onClear={onClear}
          onOpenDetails={onOpenDetails}
        />
      ) : (
        <Many data={data} photos={selection} seriesContext={seriesContext} onClear={onClear} />
      )}
    </aside>
  );
}

// ── 共通の小さな部品 ────────────────────────────────────────

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset className="st-seg" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          className="st-ax-btn st-seg__item"
          onClick={() => value !== v && onChange(v)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="st-section">
      <div className="st-section__head">
        <h3 className="st-section__title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** シリーズのチェック一覧。tri-state（一部だけ入っている）にも対応。 */
function SeriesChecklist({
  data,
  photos,
}: {
  data: StudioData;
  photos: StudioPhoto[];
}) {
  const { remember, fail, refresh } = useStudio();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  // 押した瞬間にチェックを変える（保存の往復を待たない）。保存が済むか失敗したら外す。
  const [pending, setPending] = useState<Map<number, boolean>>(new Map());
  const ids = photos.map((p) => p.id);
  const toggle = async (seriesId: number, add: boolean) => {
    setPending((m) => new Map(m).set(seriesId, add));
    try {
      await toggleNow(seriesId, add);
    } finally {
      setPending((m) => {
        const next = new Map(m);
        next.delete(seriesId);
        return next;
      });
    }
  };
  const toggleNow = async (seriesId: number, add: boolean) => {
    const name = data.seriesById.get(seriesId)?.title ?? "";
    const members = new Set(data.membersBySeries.get(seriesId) ?? []);
    const changing = ids.filter((id) => members.has(id) !== add);
    if (changing.length === 0) return;
    const before = data.allMembersBySeries.get(seriesId) ?? [];
    try {
      await seriesPhotos(seriesId, add ? { add: changing } : { remove: changing });
      await refresh();
      remember(
        {
          label: add ? "シリーズへ入れる" : "シリーズから外す",
          run: async () => {
            await seriesPhotos(seriesId, add ? { remove: changing } : { add: changing });
            if (!add) {
              // 外す前の並びに戻す。
              await reorderSeriesPhotos(seriesId, before);
            }
          },
        },
        `${changing.length === 1 ? "" : `${changing.length}枚を`}「${name}」${add ? "に入れました" : "から外しました"}`,
      );
    } catch {
      fail("シリーズを保存できませんでした。");
    }
  };
  const create = async () => {
    const t = title.trim();
    if (!t) return;
    try {
      const { series } = await createSeries({ title: t, slug: slugFromTitle(t), kind: "series", isPublished: true });
      await seriesPhotos(series.id, { add: ids });
      setTitle("");
      setCreating(false);
      await refresh();
      remember(
        { label: "シリーズへ入れる", run: () => seriesPhotos(series.id, { remove: ids }) },
        `新しいシリーズ「${t}」を作って入れました`,
      );
    } catch {
      fail("シリーズを作れませんでした（同じ URL のシリーズが既にあるかもしれません）。");
    }
  };
  return (
    <Section
      title="シリーズ"
      aside={
        !creating && (
          <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(true)}>
            ＋ 新しく作る
          </button>
        )
      }
    >
      {data.series.length === 0 && !creating && (
        <p className="st-note">まだシリーズがありません。どのシリーズにも入れなくても、写真はサイトに並びます。</p>
      )}
      <ul className="st-checks">
        {data.series.map((s) => {
          const members = new Set(data.membersBySeries.get(s.id) ?? []);
          const n = ids.filter((id) => members.has(id)).length;
          const want = pending.get(s.id);
          const state =
            want !== undefined ? (want ? "all" : "none") : n === 0 ? "none" : n === ids.length ? "all" : "some";
          return (
            <li key={s.id}>
              <label className="st-check">
                <input
                  type="checkbox"
                  checked={state === "all"}
                  ref={(el) => {
                    if (el) el.indeterminate = state === "some";
                  }}
                  onChange={() => void toggle(s.id, state !== "all")}
                />
                <span className="st-check__label">{s.title}</span>
                {s.kind === "work" && <span className="st-tag">Work</span>}
                {s.isPublished === false && <span className="st-tag">非公開</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {creating && (
        <form
          className="st-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            className="st-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="シリーズの題名"
            aria-label="新しいシリーズの題名"
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button type="submit" className="st-ax-btn st-button st-button--primary" disabled={!title.trim()}>
            作って入れる
          </button>
          <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(false)}>
            やめる
          </button>
        </form>
      )}
    </Section>
  );
}

function PublishRow({ photos }: { photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const [want, setWant] = useState<boolean | null>(null);
  const shown = photos.filter((p) => p.isPublished !== false).length;
  const value =
    want !== null ? (want ? "public" : "hidden") : shown === photos.length ? "public" : shown === 0 ? "hidden" : null;
  const set = async (publish: boolean) => {
    setWant(publish);
    try {
      await setNow(publish);
    } finally {
      setWant(null);
    }
  };
  const setNow = async (publish: boolean) => {
    const changing = photos.filter((p) => (p.isPublished !== false) !== publish).map((p) => p.id);
    if (!changing.length) return;
    try {
      await batch(changing, publish ? "publish" : "unpublish");
      await refresh();
      remember(
        { label: publish ? "公開" : "非公開", run: () => batch(changing, publish ? "unpublish" : "publish") },
        `${changing.length === 1 ? "" : `${changing.length}枚を`}${publish ? "公開しました" : "非公開にしました（サイトに出ません）"}`,
      );
    } catch {
      fail("公開の設定を保存できませんでした。");
    }
  };
  return (
    <Segmented
      label="公開"
      value={value}
      options={[
        ["public", "公開"],
        ["hidden", "非公開"],
      ]}
      onChange={(v) => void set(v === "public")}
    />
  );
}

function HeroRow({ data, photos }: { data: StudioData; photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const ids = photos.map((p) => p.id);
  const [want, setWant] = useState<boolean | null>(null);
  const n = ids.filter((id) => data.heroSet.has(id)).length;
  const on = want ?? n === ids.length;
  const toggle = async () => {
    const next = !on;
    setWant(next);
    try {
      await toggleNow(next);
    } finally {
      setWant(null);
    }
  };
  const toggleNow = async (next: boolean) => {
    const changing = ids.filter((id) => data.heroSet.has(id) !== next);
    try {
      await batch(changing, next ? "feature" : "unfeature");
      await refresh();
      remember(
        { label: "トップの先頭", run: () => batch(changing, next ? "unfeature" : "feature") },
        next ? "トップの先頭に並べました" : "トップの先頭から外しました（写真はトップに残ります）",
      );
    } catch {
      fail("トップの設定を保存できませんでした。");
    }
  };
  return (
    <label className="st-check st-check--line">
      <input
        type="checkbox"
        checked={on}
        ref={(el) => {
          if (el) el.indeterminate = want === null && n > 0 && !on;
        }}
        onChange={() => void toggle()}
      />
      <span className="st-check__label">トップに出す</span>
    </label>
  );
}

function MediumRow({ photos }: { photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const [want, setWant] = useState<"film" | "digital" | null>(null);
  const film = photos.filter((p) => p.filmType === FILM).length;
  const digital = photos.filter((p) => p.filmType === DIGITAL).length;
  const value = want ?? (film === photos.length ? "film" : digital === photos.length ? "digital" : null);
  const set = async (medium: "film" | "digital") => {
    setWant(medium);
    try {
      await setNow(medium);
    } finally {
      setWant(null);
    }
  };
  const setNow = async (medium: "film" | "digital") => {
    const target = medium === "film" ? FILM : DIGITAL;
    const changing = photos.filter((p) => p.filmType !== target);
    const before = new Map<string | null, number[]>();
    for (const p of changing) before.set(p.filmType ?? null, [...(before.get(p.filmType ?? null) ?? []), p.id]);
    try {
      await batch(changing.map((p) => p.id), "filmType", target);
      await refresh();
      remember(
        {
          label: "媒体",
          run: async () => {
            for (const [ft, ids] of before) await batch(ids, "filmType", ft ?? "");
          },
        },
        `${changing.length === 1 ? "" : `${changing.length}枚を`}${target}にしました`,
      );
    } catch {
      fail("媒体を保存できませんでした。");
    }
  };
  return (
    <Segmented
      label="媒体"
      value={value}
      options={[
        ["film", FILM],
        ["digital", DIGITAL],
      ]}
      onChange={(v) => void set(v)}
    />
  );
}

function TrashButton({ photos, onDone }: { photos: StudioPhoto[]; onDone: () => void }) {
  const { remember, fail, refresh } = useStudio();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [photos]);
  const run = async () => {
    const done: number[] = [];
    try {
      for (const p of photos) {
        await trashPhoto(p.id);
        done.push(p.id);
      }
    } catch {
      fail(done.length ? `${done.length}枚だけゴミ箱へ移しました。` : "ゴミ箱へ移せませんでした。");
    }
    if (!done.length) return;
    await refresh();
    onDone();
    remember(
      {
        label: "ゴミ箱への移動",
        run: async () => {
          for (const id of done) await restorePhoto(id);
        },
      },
      `${done.length === 1 ? "" : `${done.length}枚を`}ゴミ箱へ移しました（30日間は戻せます）`,
    );
  };
  return confirm ? (
    <div className="st-confirm">
      <p>{photos.length === 1 ? "この写真" : `${photos.length}枚`}をゴミ箱へ移しますか？（30日間は戻せます）</p>
      <div className="st-confirm__actions">
        <button type="button" className="st-ax-btn st-button st-button--danger" onClick={() => void run()}>
          ゴミ箱へ移す
        </button>
        <button type="button" className="st-ax-btn st-link" onClick={() => setConfirm(false)}>
          やめる
        </button>
      </div>
    </div>
  ) : (
    <button type="button" className="st-ax-btn st-link st-link--danger" onClick={() => setConfirm(true)}>
      ゴミ箱へ
    </button>
  );
}

function SeriesContextActions({
  data,
  seriesId,
  photos,
  onClear,
}: {
  data: StudioData;
  seriesId: number;
  photos: StudioPhoto[];
  onClear: () => void;
}) {
  const { remember, fail, refresh } = useStudio();
  const s = data.seriesById.get(seriesId);
  if (!s) return null;
  const ids = photos.map((p) => p.id);
  const single = photos.length === 1 ? photos[0]! : null;
  const setCover = async () => {
    if (!single) return;
    const before = s.coverPhotoId ?? null;
    try {
      await patchSeries(s.id, { coverPhotoId: single.id });
      await refresh();
      remember({ label: "表紙", run: () => patchSeries(s.id, { coverPhotoId: before }) }, `「${s.title}」の表紙にしました`);
    } catch {
      fail("表紙を保存できませんでした。");
    }
  };
  const remove = async () => {
    const before = data.allMembersBySeries.get(seriesId) ?? [];
    try {
      await seriesPhotos(seriesId, { remove: ids });
      await refresh();
      onClear();
      remember(
        {
          label: "シリーズから外す",
          run: async () => {
            await seriesPhotos(seriesId, { add: ids });
            await reorderSeriesPhotos(seriesId, before);
          },
        },
        `${ids.length === 1 ? "" : `${ids.length}枚を`}「${s.title}」から外しました（写真は残ります）`,
      );
    } catch {
      fail("シリーズから外せませんでした。");
    }
  };
  return (
    <div className="st-context">
      {single && (
        <button
          type="button"
          className="st-ax-btn st-button"
          disabled={s.coverPhotoId === single.id}
          onClick={() => void setCover()}
        >
          {s.coverPhotoId === single.id ? "このシリーズの表紙です" : "このシリーズの表紙にする"}
        </button>
      )}
      <button type="button" className="st-ax-btn st-button" onClick={() => void remove()}>
        このシリーズから外す
      </button>
    </div>
  );
}

// ── 1枚のとき ───────────────────────────────────────────

function useAutosave(photo: StudioPhoto, field: "title" | "description" | "camera" | "lens" | "shotAt") {
  const { fail, refresh, say } = useStudio();
  const initial = (photo[field] as string | null | undefined) ?? "";
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const save = async () => {
    if (value === initial) return;
    if (field === "shotAt" && value && !/^\d{4}-\d{2}-\d{2}/.test(value)) {
      fail("撮影日は 2025-10-04 の形で入れてください。");
      return;
    }
    try {
      await patchPhoto(photo.id, { [field]: value.trim() ? value.trim() : field === "title" || field === "description" ? "" : null });
      await refresh();
      say({ text: "保存しました" });
    } catch {
      fail("保存できませんでした。もう一度お試しください。");
    }
  };
  return { value, setValue, save };
}

function Single({
  data,
  photo,
  seriesContext,
  onClear,
  onOpenDetails,
}: {
  data: StudioData;
  photo: StudioPhoto;
  seriesContext?: number;
  onClear: () => void;
  onOpenDetails?: (photoId: number) => void;
}) {
  const title = useAutosave(photo, "title");
  const description = useAutosave(photo, "description");
  const camera = useAutosave(photo, "camera");
  const lens = useAutosave(photo, "lens");
  const shotAt = useAutosave(photo, "shotAt");
  const { fail, refresh, say } = useStudio();
  const line = [shotLine(photo), photo.camera].filter(Boolean).join(" · ");
  const setCategory = async (slug: string) => {
    try {
      await patchPhoto(photo.id, { category: slug });
      await refresh();
      say({ text: "保存しました" });
    } catch {
      fail("分類を保存できませんでした。");
    }
  };
  const rotate = async () => {
    try {
      await batch([photo.id], "rotate_right");
      await refresh();
    } catch {
      fail("回転できませんでした。");
    }
  };
  const keyToSave = (e: React.KeyboardEvent, save: () => Promise<void>) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      void save();
    }
  };
  return (
    <div className="st-inspector__body">
      <figure className="st-preview">
        <img src={adminPhotoSrc(photo, 1200, 80)} alt="" className="st-preview__img" />
        <figcaption className="st-preview__cap">
          <span className="st-preview__file">{photo.filename}</span>
          {line && <span>{line}</span>}
        </figcaption>
      </figure>

      {seriesContext != null && (
        <SeriesContextActions data={data} seriesId={seriesContext} photos={[photo]} onClear={onClear} />
      )}

      <Section title="サイトに出す">
        <PublishRow photos={[photo]} />
        <HeroRow data={data} photos={[photo]} />
      </Section>

      <SeriesChecklist data={data} photos={[photo]} />

      <Section title="言葉">
        <label className="st-field">
          <span className="st-field__label">題（なくても構いません）</span>
          <input
            className="st-input"
            value={title.value}
            onChange={(e) => title.setValue(e.target.value)}
            onBlur={() => void title.save()}
            onKeyDown={(e) => keyToSave(e, title.save)}
          />
        </label>
        <label className="st-field">
          <span className="st-field__label">説明</span>
          <textarea
            className="st-input st-input--area"
            rows={3}
            value={description.value}
            onChange={(e) => description.setValue(e.target.value)}
            onBlur={() => void description.save()}
          />
        </label>
      </Section>

      <Section title="撮影">
        <MediumRow photos={[photo]} />
        <div className="st-field-row">
          <label className="st-field">
            <span className="st-field__label">撮影日</span>
            <input
              className="st-input"
              value={shotAt.value}
              placeholder="2025-10-04"
              onChange={(e) => shotAt.setValue(e.target.value)}
              onBlur={() => void shotAt.save()}
              onKeyDown={(e) => keyToSave(e, shotAt.save)}
            />
          </label>
          {data.categories.length > 0 && (
            <label className="st-field">
              <span className="st-field__label">分類</span>
              <select
                className="st-input"
                value={photo.category ?? ""}
                onChange={(e) => void setCategory(e.target.value)}
              >
                <option value="">なし</option>
                {data.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="st-field">
          <span className="st-field__label">カメラ</span>
          <input
            className="st-input"
            value={camera.value}
            onChange={(e) => camera.setValue(e.target.value)}
            onBlur={() => void camera.save()}
            onKeyDown={(e) => keyToSave(e, camera.save)}
          />
        </label>
        <label className="st-field">
          <span className="st-field__label">レンズ</span>
          <input
            className="st-input"
            value={lens.value}
            onChange={(e) => lens.setValue(e.target.value)}
            onBlur={() => void lens.save()}
            onKeyDown={(e) => keyToSave(e, lens.save)}
          />
        </label>
      </Section>

      <div className="st-inspector__foot">
        <button type="button" className="st-ax-btn st-link" onClick={() => void rotate()}>
          右に90°回す
        </button>
        {onOpenDetails && (
          <button type="button" className="st-ax-btn st-link" onClick={() => onOpenDetails(photo.id)}>
            構図・詳しい道具
          </button>
        )}
        <TrashButton photos={[photo]} onDone={onClear} />
      </div>
    </div>
  );
}

// ── 複数のとき ─────────────────────────────────────────

function Many({
  data,
  photos,
  seriesContext,
  onClear,
}: {
  data: StudioData;
  photos: StudioPhoto[];
  seriesContext?: number;
  onClear: () => void;
}) {
  const strip = useMemo(() => photos.slice(0, 12), [photos]);
  const { fail, refresh, remember } = useStudio();
  const setCategory = async (slug: string) => {
    const before = new Map<string, number[]>();
    for (const p of photos) before.set(p.category ?? "", [...(before.get(p.category ?? "") ?? []), p.id]);
    try {
      await batch(photos.map((p) => p.id), "category", slug);
      await refresh();
      remember(
        {
          label: "分類",
          run: async () => {
            for (const [c, ids] of before) await batch(ids, "category", c);
          },
        },
        `${photos.length}枚の分類を変えました`,
      );
    } catch {
      fail("分類を保存できませんでした。");
    }
  };
  return (
    <div className="st-inspector__body">
      <div className="st-strip" aria-hidden="true">
        {strip.map((p) => (
          <img key={p.id} src={adminPhotoSrc(p, 240, 60)} alt="" />
        ))}
        {photos.length > strip.length && <span className="st-strip__more">＋{photos.length - strip.length}</span>}
      </div>
      {seriesContext != null && (
        <SeriesContextActions data={data} seriesId={seriesContext} photos={photos} onClear={onClear} />
      )}
      <Section title="サイトに出す">
        <PublishRow photos={photos} />
        <HeroRow data={data} photos={photos} />
      </Section>
      <SeriesChecklist data={data} photos={photos} />
      <Section title="撮影">
        <MediumRow photos={photos} />
        {data.categories.length > 0 && (
          <label className="st-field">
            <span className="st-field__label">分類</span>
            <select
              className="st-input"
              value=""
              onChange={(e) => e.target.value !== "__" && void setCategory(e.target.value)}
            >
              <option value="__">まとめて変える…</option>
              <option value="">なし</option>
              {data.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </Section>
      <div className="st-inspector__foot">
        <TrashButton photos={photos} onDone={onClear} />
      </div>
    </div>
  );
}
