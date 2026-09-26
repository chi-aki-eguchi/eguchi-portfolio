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

/**
 * 管理画面の「シリーズ」。左にシリーズ、右にそのシリーズの言葉と写真。
 * 写真はドラッグで並べ替え、「写真を加える」で写真の一覧から選んで入れる。
 * シリーズを消しても写真は消えない（どこにも入っていない写真に戻るだけ）。
 */
export function SeriesView({
  data,
  initialId,
  onShowInLibrary,
}: {
  data: StudioData;
  initialId: number | null;
  onShowInLibrary: (id: number) => void;
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
      remember({ label: "シリーズの並び", run: () => reorderSeriesList(before, after) }, "シリーズの並びを変えました");
    } catch {
      await refresh();
      fail("シリーズの並びを保存できませんでした。最新の並びを読み直しました。");
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
      fail("シリーズを作れませんでした（同じ URL のシリーズが既にあるかもしれません）。");
    }
  };

  const groups: { label: string; kind: "series" | "work"; rows: StudioSeries[] }[] = [
    { label: "Series", kind: "series", rows: data.series.filter((s) => s.kind !== "work") },
    { label: "Work", kind: "work", rows: data.series.filter((s) => s.kind === "work") },
  ];

  return (
    <div className="st-workspace st-workspace--series">
      <nav className="st-side" aria-label="シリーズ">
        {groups.map((g) => (
          <div key={g.kind}>
            <p className="st-side__label">{g.label}</p>
            <ul className="st-side__list">
              {g.rows.length === 0 && <li className="st-side__none">まだありません</li>}
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
                        {s.isPublished === false && <span className="st-tag">非公開</span>}
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
              placeholder="題名"
              aria-label="新しいシリーズの題名"
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <fieldset className="st-seg st-seg--small" aria-label="棚">
              <button type="button" className="st-ax-btn st-seg__item" aria-pressed={newKind === "series"} onClick={() => setNewKind("series")}>
                Series
              </button>
              <button type="button" className="st-ax-btn st-seg__item" aria-pressed={newKind === "work"} onClick={() => setNewKind("work")}>
                Work
              </button>
            </fieldset>
            <div className="st-side__create-actions">
              <button type="submit" className="st-ax-btn st-button st-button--primary" disabled={!newTitle.trim()}>
                作る
              </button>
              <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(false)}>
                やめる
              </button>
            </div>
          </form>
        ) : (
          <div className="st-side__foot">
            <button type="button" className="st-ax-btn st-button" onClick={() => setCreating(true)}>
              ＋ 新しいシリーズ
            </button>
          </div>
        )}
        <p className="st-side__hint">ドラッグでシリーズの並びを変えられます。</p>
      </nav>

      {active ? (
        <SeriesEditor
          key={active.id}
          data={data}
          series={active}
          onDeleted={() => setStoredId(null)}
          onShowInLibrary={onShowInLibrary}
          importFiles={importFiles}
          uploading={upload !== null}
        />
      ) : (
        <div className="st-main">
          <div className="st-empty">
            <p>シリーズは、写真をまとめて見せたいときの入れ物です。どのシリーズにも入れなくても、写真はサイトに並びます。</p>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => setCreating(true)}>
              ＋ 新しいシリーズ
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
  importFiles,
  uploading,
}: {
  data: StudioData;
  series: StudioSeries;
  onDeleted: () => void;
  onShowInLibrary: (id: number) => void;
  importFiles: (files: File[], target: number | null) => Promise<number[]>;
  uploading: boolean;
}) {
  const { remember, fail, refresh, say } = useStudio();
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

  // ── 言葉（下書きをまとめて保存） ──
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
  useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft.title.trim()) {
      fail("題名を入れてください。");
      return;
    }
    if (!/^[\p{L}\p{N}-]+$/u.test(draft.slug.trim())) {
      fail("URL には文字・数字・ハイフンだけを使えます。");
      return;
    }
    setSaving(true);
    try {
      await patchSeries(series.id, { ...draft, slug: draft.slug.trim(), title: draft.title.trim() });
      await refresh();
      say({ text: "保存しました" });
    } catch {
      fail("保存できませんでした（同じ URL のシリーズが既にあるかもしれません）。");
    } finally {
      setSaving(false);
    }
  };
  const setField = async (body: Record<string, unknown>, label: string, undoBody: Record<string, unknown>) => {
    try {
      await patchSeries(series.id, body);
      await refresh();
      remember({ label, run: () => patchSeries(series.id, undoBody) }, `${label}を変えました`);
    } catch {
      fail("保存できませんでした。");
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
      remember({ label: "並び", run: () => reorderSeriesPhotos(series.id, before) }, "並びを変えました");
    } catch {
      await refresh();
      fail("並びを保存できませんでした。最新の並びを読み直しました。");
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = async () => {
    try {
      await deleteSeries(series.id);
      await refresh();
      onDeleted();
      say({ text: `「${series.title}」を消しました（写真は残っています）` });
    } catch {
      fail("シリーズを消せませんでした。");
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
              aria-label="シリーズの題名"
            />
            <div className="st-series-head__actions">
              <fieldset className="st-seg st-seg--small" aria-label="公開">
                <button
                  type="button"
                  className="st-ax-btn st-seg__item"
                  aria-pressed={series.isPublished !== false}
                  onClick={() => series.isPublished === false && void setField({ isPublished: true }, "公開", { isPublished: false })}
                >
                  公開
                </button>
                <button
                  type="button"
                  className="st-ax-btn st-seg__item"
                  aria-pressed={series.isPublished === false}
                  onClick={() => series.isPublished !== false && void setField({ isPublished: false }, "非公開", { isPublished: true })}
                >
                  非公開
                </button>
              </fieldset>
              <a className="st-link" href={seriesHref(series)} target="_blank" rel="noopener">
                サイトで見る ↗
              </a>
            </div>
          </div>
          <div className="st-series-fields">
            <label className="st-field">
              <span className="st-field__label">副題</span>
              <input
                className="st-input"
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
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
                />
              </span>
            </label>
            <label className="st-field st-field--wide">
              <span className="st-field__label">言葉（シリーズのページの最初に出ます）</span>
              <textarea
                className="st-input st-input--area"
                rows={4}
                value={draft.statement}
                onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
              />
            </label>
          </div>
          <div className="st-series-head__save">
            <button type="button" className="st-ax-btn st-button st-button--primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "保存しています…" : dirty ? "言葉を保存する" : "保存済み"}
            </button>
            {dirty && (
              <button type="button" className="st-ax-btn st-link" onClick={() => setDraft(initial)}>
                元に戻す
              </button>
            )}
            <span className="st-series-head__spacer" />
            <fieldset className="st-seg st-seg--small" aria-label="棚">
              <button
                type="button"
                className="st-ax-btn st-seg__item"
                aria-pressed={series.kind !== "work"}
                onClick={() => series.kind === "work" && void setField({ kind: "series" }, "棚", { kind: "work" })}
              >
                Series
              </button>
              <button
                type="button"
                className="st-ax-btn st-seg__item"
                aria-pressed={series.kind === "work"}
                onClick={() => series.kind !== "work" && void setField({ kind: "work" }, "棚", { kind: "series" })}
              >
                Work
              </button>
            </fieldset>
            {confirmDelete ? (
              <span className="st-confirm st-confirm--inline">
                シリーズを消しますか？（写真は残ります）
                <button type="button" className="st-ax-btn st-button st-button--danger" onClick={() => void remove()}>
                  消す
                </button>
                <button type="button" className="st-ax-btn st-link" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </span>
            ) : (
              <button type="button" className="st-ax-btn st-link st-link--danger" onClick={() => setConfirmDelete(true)}>
                シリーズを消す
              </button>
            )}
          </div>
        </div>

        <div className="st-toolbar">
          <div className="st-toolbar__title">
            <h2>写真</h2>
            <span className="st-toolbar__count">{photos.length}枚</span>
            <button type="button" className="st-ax-btn st-link" onClick={() => onShowInLibrary(series.id)}>
              写真の画面で開く
            </button>
          </div>
          <div className="st-toolbar__tools">
            <fieldset className="st-seg st-seg--small" aria-label="写真の大きさ">
              {(["s", "m", "l"] as GridSize[]).map((k) => (
                <button key={k} type="button" aria-pressed={size === k} className="st-ax-btn st-seg__item" onClick={() => setSize(k)}>
                  {k === "s" ? "小" : k === "m" ? "中" : "大"}
                </button>
              ))}
            </fieldset>
            <button type="button" className="st-ax-btn st-button" aria-pressed={pickMode} onClick={() => setPickMode((v) => !v)}>
              {pickMode ? "選び終える" : "まとめて選ぶ"}
            </button>
            <button type="button" className="st-ax-btn st-button" onClick={() => fileInput.current?.click()} disabled={uploading}>
              新しく取り込む
            </button>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => setPickerOpen(true)}>
              写真を加える
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
            ...(p.isPublished === false ? ["非公開"] : []),
            ...(series.coverPhotoId === p.id ? ["表紙"] : []),
          ]}
          scrollRef={scrollRef}
          empty={
            <p>
              まだ写真がありません。「写真を加える」で写真の一覧から選ぶか、ここへ写真を落としてください。
            </p>
          }
        />
      </div>
      <Inspector data={data} selection={selection} seriesContext={series.id} onClear={clear} />
      {pickerOpen && (
        <PhotoPicker
          data={data}
          exclude={new Set(ids)}
          title={`「${series.title}」に加える写真`}
          onClose={() => setPickerOpen(false)}
          onPick={async (picked) => {
            try {
              await seriesPhotos(series.id, { add: picked });
              await refresh();
              remember(
                { label: "シリーズへ入れる", run: () => seriesPhotos(series.id, { remove: picked }) },
                `${picked.length}枚を加えました`,
              );
              setPickerOpen(false);
            } catch {
              fail("写真を加えられませんでした。");
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
        <fieldset className="st-seg st-seg--small" aria-label="どの写真から">
          <button type="button" className="st-ax-btn st-seg__item" aria-pressed={scope === "loose"} onClick={() => setScope("loose")}>
            シリーズに入っていない
          </button>
          <button type="button" className="st-ax-btn st-seg__item" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
            すべて
          </button>
        </fieldset>
        <input
          className="st-input st-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="探す"
          aria-label="写真を探す"
        />
        <button type="button" className="st-ax-btn st-link" onClick={() => ref.current?.close()}>
          閉じる
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
          badges={(p) => (p.isPublished === false ? ["非公開"] : [])}
          scrollRef={scrollRef}
          empty={<p>加えられる写真はありません。</p>}
        />
      </div>
      <div className="st-dialog__foot">
        <span className="st-note">{selected.size}枚を選んでいます（Shift で範囲）</span>
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
          {selected.size ? `${selected.size}枚を加える` : "写真を選んでください"}
        </button>
      </div>
    </dialog>
  );
}
