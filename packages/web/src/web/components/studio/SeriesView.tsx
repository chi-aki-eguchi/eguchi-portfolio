import { buildPublicSiteHref } from "../../pages/admin-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminPhotoSrc, usePersistentState } from "../../pages/admin-shared";
import { applyWorkOrder, idsBetween, moveManyTo } from "../../lib/work-order";
import { seriesHref } from "../../lib/series-links";
import { StudioGrid, type GridSize } from "./StudioGrid";
import { Inspector } from "./Inspector";
import {
  createSeries,
  deleteSeries,
  matchesQuery,
  patchSeries,
  reorderSeriesList,
  reorderSeriesPhotos,
  seriesPhotos,
  slugFromTitle,
  useStudio,
  type StudioData,
  type StudioPhoto,
  type StudioSeries,
} from "./studio-data";
import { adminText as tx } from "../../pages/admin-i18n";

/**
 * 管理画面の「シリーズ」。左にシリーズ、右にそのシリーズの言葉と写真。
 * 写真はドラッグで並べ替え、「写真を加える」で写真の一覧から選んで入れる。
 * シリーズを消しても写真は消えない（どこにも入っていない写真に戻るだけ）。
 */
export function SeriesView({
  data,
  initialId,
  onShowInLibrary,
  onOpenDetails,
}: {
  data: StudioData;
  initialId: number | null;
  onShowInLibrary: (id: number) => void;
  /** シリーズごとの配色・並び順の上書きなど、詳しい設定（サイト → シリーズの詳しい設定）を開く */
  onOpenDetails?: () => void;
}) {
  const [storedId, setStoredId] = usePersistentState<number | null>("studio:series", null);
  const activeId = initialId ?? storedId;
  useEffect(() => {
    if (initialId != null) setStoredId(initialId);
  }, [initialId, setStoredId]);
  const active = (activeId != null ? data.seriesById.get(activeId) : undefined) ?? data.series[0];
  const { remember, fail, refresh, importFiles, upload } = useStudio();
  const qc = useQueryClient();

  // ── シリーズどうしの並び ──
  const [dragSeries, setDragSeries] = useState<number | null>(null);
  const [overSeries, setOverSeries] = useState<number | null>(null);
  const reorderList = async (dragId: number, targetId: number) => {
    const before = data.series.map((s) => s.id);
    const from = before.indexOf(dragId);
    const to = before.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const after = [...before];
    after.splice(from, 1);
    after.splice(to, 0, dragId);
    const rank = new Map(after.map((id, i) => [id, i]));
    qc.setQueryData<{ series: StudioSeries[] }>(["admin-series"], (old) =>
      old ? { series: old.series.map((s) => ({ ...s, sortOrder: rank.get(s.id) ?? s.sortOrder })) } : old,
    );
    try {
      await reorderSeriesList(after, before);
      await refresh();
      remember({ label: tx("シリーズの並び", "Series order"), run: () => reorderSeriesList(before, after) }, tx("シリーズの並びを変えました", "Changed the series order"));
    } catch {
      await refresh();
      fail(tx("シリーズの並びを保存できませんでした。最新の並びを読み直しました。", "Could not save the series order. Reloaded the latest order."));
    }
  };

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<"series" | "work">("series");
  const create = async () => {
    const t = newTitle.trim();
    if (!t) return;
    try {
      const { series } = await createSeries({ title: t, slug: slugFromTitle(t), kind: newKind, isPublished: true });
      setNewTitle("");
      setCreating(false);
      await refresh();
      setStoredId(series.id);
    } catch {
      fail(tx("シリーズを作れませんでした（同じ URL のシリーズが既にあるかもしれません）。", "Could not create the series (a series with the same URL may already exist)."));
    }
  };

  const groups: { label: string; kind: "series" | "work"; rows: StudioSeries[] }[] = [
    { label: tx("シリーズ", "Series"), kind: "series", rows: data.series.filter((s) => s.kind !== "work") },
    { label: tx("単発の仕事（Work）", "Work"), kind: "work", rows: data.series.filter((s) => s.kind === "work") },
  ];

  return (
    <div className="st-workspace st-workspace--series">
      <nav className="st-side" aria-label={tx("シリーズ", "Series")}>
        {groups.map((g) => (
          <div key={g.kind}>
            <p className="st-side__label">{g.label}</p>
            <ul className="st-side__list">
              {g.rows.length === 0 && <li className="st-side__none">{tx("まだありません", "None yet")}</li>}
              {g.rows.map((s) => {
                const members = data.membersBySeries.get(s.id) ?? [];
                const cover = data.photoById.get(s.coverPhotoId ?? -1) ?? data.photoById.get(members[0] ?? -1);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="st-ax-btn st-side__item st-side__item--series"
                      aria-current={active?.id === s.id ? "page" : undefined}
                      data-drop={overSeries === s.id || undefined}
                      draggable
                      onDragStart={() => setDragSeries(s.id)}
                      onDragEnd={() => {
                        setDragSeries(null);
                        setOverSeries(null);
                      }}
                      onDragOver={(e) => {
                        if (dragSeries == null || dragSeries === s.id) return;
                        e.preventDefault();
                        setOverSeries(s.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragSeries != null) void reorderList(dragSeries, s.id);
                        setDragSeries(null);
                        setOverSeries(null);
                      }}
                      onClick={() => setStoredId(s.id)}
                    >
                      <span className="st-side__thumb">
                        {cover && <img src={adminPhotoSrc(cover, 160, 60)} alt="" />}
                      </span>
                      <span className="st-side__title">
                        <span className="st-side__text">{s.title}</span>
                        {s.isPublished === false && <span className="st-tag">{tx("非公開", "Hidden")}</span>}
                      </span>
                      <span className="st-side__count">{members.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {creating ? (
          <form
            className="st-side__create"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input
              className="st-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={tx("題名", "Title")}
              aria-label={tx("新しいシリーズの題名", "New series title")}
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <fieldset className="st-seg st-seg--small" aria-label={tx("棚", "Shelf")}>
              <button type="button" className="st-ax-btn st-seg__item" aria-pressed={newKind === "series"} onClick={() => setNewKind("series")}>
                {tx("シリーズ", "Series")}
              </button>
              <button type="button" className="st-ax-btn st-seg__item" aria-pressed={newKind === "work"} onClick={() => setNewKind("work")}>
                {tx("単発の仕事", "Work")}
              </button>
            </fieldset>
            <div className="st-side__create-actions">
              <button type="submit" className="st-ax-btn st-button st-button--primary" disabled={!newTitle.trim()}>
                {tx("作る", "Create")}
              </button>
              <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(false)}>
                {tx("やめる", "Cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="st-side__foot">
            <button type="button" className="st-ax-btn st-button" onClick={() => setCreating(true)}>
              {tx("＋ 新しいシリーズ", "+ New series")}
            </button>
          </div>
        )}
      </nav>

      {active ? (
        <SeriesEditor
          key={active.id}
          data={data}
          series={active}
          onDeleted={() => setStoredId(null)}
          onShowInLibrary={onShowInLibrary}
          onOpenDetails={onOpenDetails}
          importFiles={importFiles}
          uploading={upload !== null}
        />
      ) : (
        <div className="st-main">
          <div className="st-empty">
            <p>{tx("シリーズは、写真をまとめて見せたいときの入れ物です。どのシリーズにも入れなくても、写真はサイトに並びます。", "A series groups photographs you want to show together. Photos appear on the site even when they are in no series.")}</p>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => setCreating(true)}>
              {tx("＋ 新しいシリーズ", "+ New series")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesEditor({
  data,
  series,
  onDeleted,
  onShowInLibrary,
  onOpenDetails,
  importFiles,
  uploading,
}: {
  data: StudioData;
  series: StudioSeries;
  onDeleted: () => void;
  onShowInLibrary: (id: number) => void;
  onOpenDetails?: () => void;
  importFiles: (files: File[], target: number | null) => Promise<number[]>;
  uploading: boolean;
}) {
  const { demoSeed, remember, fail, refresh, say } = useStudio();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [size, setSize] = usePersistentState<GridSize>("studio:series-grid-size", "m");
  const photos = useMemo(
    () =>
      (data.membersBySeries.get(series.id) ?? [])
        .map((id) => data.photoById.get(id))
        .filter((p): p is StudioPhoto => Boolean(p)),
    [data, series.id],
  );
  const ids = useMemo(() => photos.map((p) => p.id), [photos]);

  // ── 言葉（欄を離れたら保存。写真の右の欄と同じ、2026-09-30） ──
  // 以前は「保存する」を押すまで下書きのままで、ほかのシリーズや画面へ移ると
  // 何も言わずに消えていた。公開の切り替えなど別の操作で読み直したときも、
  // 打ちかけの題名が元に戻っていた。
  type TextKey = "title" | "subtitle" | "statement" | "slug";
  const initial = useMemo(
    () => ({
      title: series.title ?? "",
      subtitle: series.subtitle ?? "",
      statement: series.statement ?? "",
      slug: series.slug ?? "",
    }),
    [series],
  );
  const [draft, setDraft] = useState(initial);
  const prevInitial = useRef(initial);
  useEffect(() => {
    const prev = prevInitial.current;
    prevInitial.current = initial;
    // 保存し終えた値・ほかの操作で変わった値は取り込み、打ちかけの欄はそのまま残す。
    setDraft((d) => {
      const next = { ...d };
      (Object.keys(initial) as TextKey[]).forEach((k) => {
        if (d[k] === prev[k]) next[k] = initial[k];
      });
      return next;
    });
  }, [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const saveText = async () => {
    const changed = (Object.keys(initial) as TextKey[]).filter((k) => draft[k] !== initial[k]);
    if (changed.length === 0 || savingRef.current) return;
    if (!draft.title.trim()) {
      fail(tx("題名を入れてください（空のままでは保存しません）。", "Please enter a title (an empty title is not saved)."));
      return;
    }
    if (!/^[\p{L}\p{N}-]+$/u.test(draft.slug.trim())) {
      fail(tx("URL には文字・数字・ハイフンだけを使えます（直すまで保存しません）。", "Use only letters, numbers and hyphens in the URL (not saved until fixed)."));
      return;
    }
    const body: Record<string, string> = {};
    const undoBody: Record<string, string> = {};
    for (const k of changed) {
      body[k] = k === "title" || k === "slug" ? draft[k].trim() : draft[k];
      undoBody[k] = initial[k];
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await patchSeries(series.id, body);
      await refresh();
      remember({ label: tx("シリーズの言葉", "series text"), run: () => patchSeries(series.id, undoBody) }, tx("保存しました", "Saved"));
    } catch {
      fail(tx("保存できませんでした（同じ URL のシリーズが既にあるかもしれません）。", "Could not save (a series with the same URL may already exist)."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const setField = async (body: Record<string, unknown>, label: string, undoBody: Record<string, unknown>) => {
    try {
      await patchSeries(series.id, body);
      await refresh();
      remember({ label, run: () => patchSeries(series.id, undoBody) }, tx(`${label}を変えました`, `Changed ${label}`));
    } catch {
      fail(tx("保存できませんでした。", "Could not save."));
    }
  };

  // ── 選ぶ ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const anchor = useRef<number | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const selection = useMemo(() => photos.filter((p) => selectedIds.has(p.id)), [photos, selectedIds]);
  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const onSelect = (id: number, mode: "only" | "toggle" | "range") => {
    setSelectedIds((prev) => {
      if (mode === "range" && anchor.current != null) {
        const next = new Set(prev);
        for (const x of idsBetween(ids, anchor.current, id)) next.add(x);
        return next;
      }
      anchor.current = id;
      if (mode === "toggle") {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return prev.size === 1 && prev.has(id) ? new Set() : new Set([id]);
    });
  };

  const onReorder = async (moving: number[], at: number) => {
    // ゴミ箱の写真も含めたシリーズの並び全体に、見えている写真の新しい並びを当てる。
    const before = data.allMembersBySeries.get(series.id) ?? ids;
    const after = applyWorkOrder(before, moveManyTo(ids, moving, at));
    const rank = new Map(after.map((id, i) => [id, i]));
    qc.setQueryData<{ memberships: { seriesId: number; photoId: number; sortOrder: number }[] }>(
      ["admin-series-photos"],
      (old) =>
        old
          ? {
              memberships: old.memberships.map((m) =>
                m.seriesId === series.id && rank.has(m.photoId) ? { ...m, sortOrder: rank.get(m.photoId)! } : m,
              ),
            }
          : old,
    );
    try {
      await reorderSeriesPhotos(series.id, after);
      await refresh();
      remember({ label: tx("並び", "Order"), run: () => reorderSeriesPhotos(series.id, before) }, tx("並びを変えました", "Changed the order"));
    } catch {
      await refresh();
      fail(tx("並びを保存できませんでした。最新の並びを読み直しました。", "Could not save the order. Reloaded the latest order."));
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = async () => {
    try {
      await deleteSeries(series.id);
      await refresh();
      onDeleted();
      say({ text: tx(`「${series.title}」を消しました（写真は残っています）`, `Deleted “${series.title}” (the photos are kept)`) });
    } catch {
      fail(tx("シリーズを消せませんでした。", "Could not delete the series."));
    }
  };

  return (
    <>
      <div className="st-main" ref={scrollRef}>
        <div className="st-series-head">
          <div className="st-series-head__row">
            <input
              className="st-title-input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onBlur={() => void saveText()}
              aria-label={tx("シリーズの題名", "Series title")}
            />
            <div className="st-series-head__actions">
              <fieldset className="st-seg st-seg--small" aria-label={tx("公開", "Visibility")}>
                <button
                  type="button"
                  className="st-ax-btn st-seg__item"
                  aria-pressed={series.isPublished !== false}
                  onClick={() => series.isPublished === false && void setField({ isPublished: true }, tx("公開", "visibility"), { isPublished: false })}
                >
                  {tx("公開", "Public")}
                </button>
                <button
                  type="button"
                  className="st-ax-btn st-seg__item"
                  aria-pressed={series.isPublished === false}
                  onClick={() => series.isPublished !== false && void setField({ isPublished: false }, tx("非公開", "visibility"), { isPublished: true })}
                >
                  {tx("非公開", "Hidden")}
                </button>
              </fieldset>
              <a className="st-link" href={buildPublicSiteHref(demoSeed, seriesHref(series))} target="_blank" rel="noopener">
                {tx("サイトで見る ↗", "View on site ↗")}
              </a>
            </div>
          </div>
          <div className="st-series-fields">
            <label className="st-field">
              <span className="st-field__label">{tx("副題", "Subtitle")}</span>
              <input
                className="st-input"
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                onBlur={() => void saveText()}
              />
            </label>
            <label className="st-field">
              <span className="st-field__label">URL</span>
              <span className="st-url">
                <span className="st-url__base">/{series.kind === "work" ? "work" : "series"}/</span>
                <input
                  className="st-input"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  onBlur={() => void saveText()}
                  title={tx("変えると、前の URL ではページを開けなくなります。", "Changing this breaks links to the old URL.")}
                />
              </span>
            </label>
            <label className="st-field st-field--wide">
              <span className="st-field__label">{tx("言葉（シリーズのページの最初に出ます）", "Statement (shown at the top of the series page)")}</span>
              <textarea
                className="st-input st-input--area"
                rows={4}
                value={draft.statement}
                onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
                onBlur={() => void saveText()}
              />
            </label>
          </div>
          <div className="st-series-head__save">
            {/* 欄を離れると保存する。押し忘れて消える「保存する」ボタンは置かない。 */}
            <span className="st-note" aria-live="polite">
              {saving
                ? tx("保存しています…", "Saving…")
                : dirty
                  ? tx("入力中 — 欄を離れると保存します", "Editing — saved when you leave the field")
                  : ""}
            </span>
            <span className="st-series-head__spacer" />
            <fieldset className="st-seg st-seg--small" aria-label={tx("棚", "Shelf")}>
              <button
                type="button"
                className="st-ax-btn st-seg__item"
                aria-pressed={series.kind !== "work"}
                onClick={() => series.kind === "work" && void setField({ kind: "series" }, tx("棚", "shelf"), { kind: "work" })}
              >
                {tx("シリーズ", "Series")}
              </button>
              <button
                type="button"
                className="st-ax-btn st-seg__item"
                aria-pressed={series.kind === "work"}
                onClick={() => series.kind !== "work" && void setField({ kind: "work" }, tx("棚", "shelf"), { kind: "series" })}
              >
                {tx("単発の仕事", "Work")}
              </button>
            </fieldset>
            {onOpenDetails && (
              <button type="button" className="st-ax-btn st-link" onClick={onOpenDetails}>
                {tx("配色・並び順の上書き", "Colour and order overrides")}
              </button>
            )}
          </div>
        </div>

        <div className="st-toolbar">
          <div className="st-toolbar__title">
            <h2>{tx("写真", "Photos")}</h2>
            <span className="st-toolbar__count">{tx(`${photos.length}枚`, `${photos.length}`)}</span>
            <button type="button" className="st-ax-btn st-link" onClick={() => onShowInLibrary(series.id)}>
              {tx("写真の画面で開く", "Open in Photos")}
            </button>
          </div>
          <div className="st-toolbar__tools">
            <fieldset className="st-seg st-seg--small" aria-label={tx("写真の大きさ", "Photo size")}>
              {(["s", "m", "l"] as GridSize[]).map((k) => (
                <button key={k} type="button" aria-pressed={size === k} className="st-ax-btn st-seg__item" onClick={() => setSize(k)}>
                  {k === "s" ? tx("小", "S") : k === "m" ? tx("中", "M") : tx("大", "L")}
                </button>
              ))}
            </fieldset>
            <button type="button" className="st-ax-btn st-button" aria-pressed={pickMode} onClick={() => setPickMode((v) => !v)}>
              {pickMode ? tx("選び終える", "Done") : tx("まとめて選ぶ", "Select")}
            </button>
            {/* 加える入口は2つあるので、どこから加えるのかを言葉に出す（2026-09-30）。
                以前は「新しく取り込む」「写真を加える」で違いが分からなかった。 */}
            <button type="button" className="st-ax-btn st-button" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {tx("パソコンから取り込む", "Import from computer")}
            </button>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => setPickerOpen(true)}>
              {tx("写真の一覧から加える", "Add from your photos")}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,.heic,.heif,.tif,.tiff"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void importFiles(files, series.id);
              }}
            />
          </div>
        </div>
        {photos.length > 1 && (
          <p className="st-note st-note--bar">
            {tx("写真はドラッグで並べ替えられます。表紙は、写真を押して右の欄で選びます。", "Drag photos to reorder. To choose the cover, click a photo and use the panel on the right.")}
          </p>
        )}
        <StudioGrid
          photos={photos}
          size={size}
          selected={selectedIds}
          onSelect={onSelect}
          pickMode={pickMode}
          canReorder
          onReorder={(moving, at) => void onReorder(moving, at)}
          onFiles={(files) => void importFiles(files, series.id)}
          badges={(p) => [
            ...(p.isPublished === false ? [tx("非公開", "Hidden")] : []),
            ...(series.coverPhotoId === p.id ? [tx("表紙", "Cover")] : []),
          ]}
          scrollRef={scrollRef}
          empty={
            <p>
              {tx("まだ写真がありません。「写真の一覧から加える」で選ぶか、ここへ写真を落としてください。", "No photos yet. Choose from your photos with “Add from your photos”, or drop photos here.")}
            </p>
          }
        />
        {/* 消す操作は、ふだんの設定と並べず、いちばん下に分けて置く（2026-09-30）。
            以前は棚の切り替えと「配色・並び順の上書き」の間に同じ灰色の文字で並んでいた。 */}
        <section className="st-danger" aria-label={tx("シリーズを消す", "Delete series")}>
          <div className="st-danger__text">
            <p className="st-danger__title">{tx("このシリーズを消す", "Delete this series")}</p>
            <p className="st-note">{tx("写真は消えません。どのシリーズにも入っていない写真に戻ります。", "The photos are kept. They go back to photos that are not in a series.")}</p>
          </div>
          {confirmDelete ? (
            <span className="st-confirm st-confirm--inline">
              {tx(`「${series.title}」を消しますか？`, `Delete “${series.title}”?`)}
              <button type="button" className="st-ax-btn st-button st-button--danger" onClick={() => void remove()}>
                {tx("消す", "Delete")}
              </button>
              <button type="button" className="st-ax-btn st-link" onClick={() => setConfirmDelete(false)}>
                {tx("やめる", "Cancel")}
              </button>
            </span>
          ) : (
            <button type="button" className="st-ax-btn st-button st-button--danger-outline" onClick={() => setConfirmDelete(true)}>
              {tx("消す…", "Delete…")}
            </button>
          )}
        </section>
      </div>
      <Inspector data={data} selection={selection} seriesContext={series.id} onClear={clear} />
      {pickerOpen && (
        <PhotoPicker
          data={data}
          exclude={new Set(ids)}
          title={tx(`「${series.title}」に加える写真`, `Photos to add to “${series.title}”`)}
          onClose={() => setPickerOpen(false)}
          onPick={async (picked) => {
            try {
              await seriesPhotos(series.id, { add: picked });
              await refresh();
              remember(
                { label: tx("シリーズへ入れる", "Add to series"), run: () => seriesPhotos(series.id, { remove: picked }) },
                tx(`${picked.length}枚を加えました`, `Added ${picked.length}`),
              );
              setPickerOpen(false);
            } catch {
              fail(tx("写真を加えられませんでした。", "Could not add the photos."));
            }
          }}
        />
      )}
    </>
  );
}

/** 写真の一覧から選んで加える。まずシリーズに入っていない写真を見せる。 */
function PhotoPicker({
  data,
  exclude,
  title,
  onClose,
  onPick,
}: {
  data: StudioData;
  exclude: Set<number>;
  title: string;
  onClose: () => void;
  onPick: (ids: number[]) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<"loose" | "all">("loose");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // 管理画面の窓は data-phase="show" で現れる（styles.css の .admin-atelier dialog）。
    const f = requestAnimationFrame(() => d?.setAttribute("data-phase", "show"));
    return () => cancelAnimationFrame(f);
  }, []);
  const list = useMemo(
    () =>
      data.photos.filter(
        (p) =>
          !exclude.has(p.id) &&
          (scope === "all" || !data.seriesOfPhoto.has(p.id)) &&
          matchesQuery(p, query),
      ),
    [data, exclude, scope, query],
  );
  const listIds = useMemo(() => list.map((p) => p.id), [list]);
  const anchor = useRef<number | null>(null);
  return (
    <dialog ref={ref} className="st-dialog st-dialog--wide" onClose={onClose} aria-label={title}>
      <div className="st-dialog__head">
        <h2>{title}</h2>
        <fieldset className="st-seg st-seg--small" aria-label={tx("どの写真から", "Choose from")}>
          <button type="button" className="st-ax-btn st-seg__item" aria-pressed={scope === "loose"} onClick={() => setScope("loose")}>
            {tx("シリーズに入っていない", "Not in a series")}
          </button>
          <button type="button" className="st-ax-btn st-seg__item" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
            {tx("すべて", "All")}
          </button>
        </fieldset>
        <input
          className="st-input st-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tx("探す", "Search")}
          aria-label={tx("写真を探す", "Search photos")}
        />
        <button type="button" className="st-ax-btn st-link" onClick={() => ref.current?.close()}>
          {tx("閉じる", "Close")}
        </button>
      </div>
      <div className="st-dialog__scroll" ref={scrollRef}>
        <StudioGrid
          photos={list}
          size="m"
          selected={selected}
          onSelect={(id, mode) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (mode === "range" && anchor.current != null) {
                for (const x of idsBetween(listIds, anchor.current, id)) next.add(x);
                return next;
              }
              anchor.current = id;
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          pickMode
          canReorder={false}
          onReorder={() => undefined}
          badges={(p) => (p.isPublished === false ? [tx("非公開", "Hidden")] : [])}
          scrollRef={scrollRef}
          empty={<p>{tx("加えられる写真はありません。", "No photos to add.")}</p>}
        />
      </div>
      <div className="st-dialog__foot">
        <span className="st-note">{tx(`${selected.size}枚を選んでいます（Shift で範囲）`, `${selected.size} selected (Shift for a range)`)}</span>
        <button
          type="button"
          className="st-ax-btn st-button st-button--primary"
          disabled={selected.size === 0 || busy}
          onClick={async () => {
            setBusy(true);
            await onPick(listIds.filter((id) => selected.has(id)));
            setBusy(false);
          }}
        >
          {selected.size ? tx(`${selected.size}枚を加える`, `Add ${selected.size}`) : tx("写真を選んでください", "Choose photos")}
        </button>
      </div>
    </dialog>
  );
}
