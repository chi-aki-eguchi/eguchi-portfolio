import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api";
import { adminPhotoSrc, jsonOrThrow, usePersistentState } from "../../pages/admin-shared";
import { applyWorkOrder, idsBetween, moveManyTo } from "../../lib/work-order";
import { DRAG_TYPE, GRID_SIZES, StudioGrid, type GridSize } from "./StudioGrid";
import { Inspector } from "./Inspector";
import {
  matchesQuery,
  reorderAllPhotos,
  reorderSeriesPhotos,
  restorePhoto,
  seriesPhotos,
  useStudio,
  type StudioData,
  type StudioPhoto,
} from "./studio-data";

type Filter =
  | { kind: "all" }
  | { kind: "loose" }
  | { kind: "hidden" }
  | { kind: "hero" }
  | { kind: "recent" }
  | { kind: "film" }
  | { kind: "digital" }
  | { kind: "series"; id: number };

const FILTER_LABEL: Record<Exclude<Filter["kind"], "series">, string> = {
  all: "すべての写真",
  loose: "シリーズに入っていない写真",
  hidden: "非公開の写真",
  hero: "トップに出す写真",
  recent: "今回加えた写真",
  film: "フィルム",
  digital: "デジタル",
};

function sameFilter(a: Filter, b: Filter) {
  return a.kind === b.kind && (a.kind !== "series" || (b.kind === "series" && a.id === b.id));
}

/**
 * 管理画面の「写真」（最初に開く画面）。
 *
 * すべての写真が主役。左の列で絞り込み（シリーズに入っていない写真・非公開・
 * 各シリーズ…）、真ん中で選んで並べ替え、右の欄で公開・シリーズ・言葉を直す。
 * 写真を左のシリーズへドラッグすると、そのシリーズに入る（ほかの所属はそのまま）。
 */
export function LibraryView({
  data,
  request,
  onRequestHandled,
  onOpenSeries,
  onOpenDetails,
}: {
  data: StudioData;
  /** シリーズの画面から「写真の画面で開く」を押したとき */
  request?: { seriesId: number; n: number } | null;
  onRequestHandled?: () => void;
  onOpenSeries: (id: number) => void;
  onOpenDetails: (photoId: number) => void;
}) {
  const qc = useQueryClient();
  const { importFiles, upload, recentIds, remember, fail, refresh } = useStudio();
  const [filter, setFilter] = usePersistentState<Filter>("studio:library-filter", { kind: "all" });
  const [size, setSize] = usePersistentState<GridSize>("studio:grid-size", "m");
  const [query, setQuery] = useState("");
  const [pickMode, setPickMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const anchor = useRef<number | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setFilter({ kind: "series", id: request.seriesId });
    onRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  // シリーズが消えたら、そのシリーズの絞り込みをやめる。
  useEffect(() => {
    if (filter.kind === "series" && !data.loading && !data.seriesById.has(filter.id)) setFilter({ kind: "all" });
  }, [filter, data.loading, data.seriesById, setFilter]);

  const base = useMemo(() => {
    const ph = data.photos;
    switch (filter.kind) {
      case "all":
        return ph;
      case "loose":
        return ph.filter((p) => !data.seriesOfPhoto.has(p.id));
      case "hidden":
        return ph.filter((p) => p.isPublished === false);
      case "hero": {
        return data.heroIds.map((id) => data.photoById.get(id)).filter((p): p is StudioPhoto => Boolean(p));
      }
      case "recent": {
        const set = new Set(recentIds);
        return ph.filter((p) => set.has(p.id));
      }
      case "film":
        return ph.filter((p) => p.filmType === "フィルム");
      case "digital":
        return ph.filter((p) => p.filmType === "デジタル");
      case "series":
        return (data.membersBySeries.get(filter.id) ?? [])
          .map((id) => data.photoById.get(id))
          .filter((p): p is StudioPhoto => Boolean(p));
    }
  }, [data, filter, recentIds]);
  const visible = useMemo(() => base.filter((p) => matchesQuery(p, query)), [base, query]);
  const visibleIds = useMemo(() => visible.map((p) => p.id), [visible]);

  // 画面から消えた写真は選択から外す。
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => data.photoById.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data.photoById]);
  const selection = useMemo(
    () => visible.filter((p) => selectedIds.has(p.id)).concat(
      [...selectedIds].filter((id) => !visibleIds.includes(id)).map((id) => data.photoById.get(id)).filter((p): p is StudioPhoto => Boolean(p)),
    ),
    [visible, visibleIds, selectedIds, data.photoById],
  );
  const clear = useCallback(() => {
    setSelectedIds(new Set());
    anchor.current = null;
  }, []);
  useEffect(() => clear(), [filter, clear]);

  const onSelect = (id: number, mode: "only" | "toggle" | "range") => {
    setSelectedIds((prev) => {
      if (mode === "range" && anchor.current != null) {
        const next = new Set(prev);
        for (const x of idsBetween(visibleIds, anchor.current, id)) next.add(x);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") clear();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear, visibleIds]);

  // ── 並べ替え ──
  const canReorder = query.trim() === "" && filter.kind !== "hero";
  const onReorder = async (moving: number[], at: number) => {
    const nextVisible = moveManyTo(visibleIds, moving, at);
    if (filter.kind === "series") {
      const before = data.allMembersBySeries.get(filter.id) ?? [];
      const after = applyWorkOrder(before, nextVisible);
      qc.setQueryData<{ memberships: { seriesId: number; photoId: number; sortOrder: number }[] }>(
        ["admin-series-photos"],
        (old) => {
          if (!old) return old;
          const rank = new Map(after.map((id, i) => [id, i]));
          return {
            memberships: old.memberships.map((m) =>
              m.seriesId === filter.id && rank.has(m.photoId) ? { ...m, sortOrder: rank.get(m.photoId)! } : m,
            ),
          };
        },
      );
      try {
        await reorderSeriesPhotos(filter.id, after);
        await refresh();
        remember({ label: "並び", run: () => reorderSeriesPhotos(filter.id, before) }, "シリーズの中の並びを変えました");
      } catch {
        await refresh();
        fail("並びを保存できませんでした。最新の並びを読み直しました。");
      }
      return;
    }
    const before = data.photos.map((p) => p.id);
    const after = applyWorkOrder(before, nextVisible);
    const rank = new Map(after.map((id, i) => [id, i]));
    qc.setQueryData<{ photos: StudioPhoto[] }>(["photos", "all"], (old) =>
      old ? { photos: old.photos.map((p) => (rank.has(p.id) ? { ...p, sortOrder: rank.get(p.id)! } : p)) } : old,
    );
    try {
      await reorderAllPhotos(after, before);
      await refresh();
      remember({ label: "並び", run: () => reorderAllPhotos(before, after) }, "サイトでの並びを変えました");
    } catch (e) {
      await refresh();
      fail(
        e instanceof Error && e.message === "conflict"
          ? "別の画面で並びが変わっていました。最新の並びを読み直しました。"
          : "並びを保存できませんでした。",
      );
    }
  };

  // ── 左の列のシリーズへ落とす ──
  const [dropSeries, setDropSeries] = useState<number | null>(null);
  const dropOnSeries = async (e: React.DragEvent, seriesId: number) => {
    setDropSeries(null);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    const ids = (JSON.parse(raw) as number[]).filter((id) => !(data.membersBySeries.get(seriesId) ?? []).includes(id));
    const name = data.seriesById.get(seriesId)?.title ?? "";
    if (ids.length === 0) {
      fail(`もう「${name}」に入っています。`);
      return;
    }
    try {
      await seriesPhotos(seriesId, { add: ids });
      await refresh();
      remember(
        { label: "シリーズへ入れる", run: () => seriesPhotos(seriesId, { remove: ids }) },
        `${ids.length === 1 ? "" : `${ids.length}枚を`}「${name}」に入れました`,
      );
    } catch {
      fail("シリーズへ入れられませんでした。");
    }
  };

  const counts = useMemo(
    () => ({
      all: data.photos.length,
      loose: data.photos.filter((p) => !data.seriesOfPhoto.has(p.id)).length,
      hidden: data.photos.filter((p) => p.isPublished === false).length,
      hero: data.heroIds.filter((id) => data.photoById.has(id)).length,
      film: data.photos.filter((p) => p.filmType === "フィルム").length,
      digital: data.photos.filter((p) => p.filmType === "デジタル").length,
      recent: recentIds.filter((id) => data.photoById.has(id)).length,
    }),
    [data, recentIds],
  );

  const importTarget = filter.kind === "series" ? filter.id : null;
  const startImport = async (files: File[]) => {
    const added = await importFiles(files, importTarget);
    if (added.length && filter.kind !== "series") setFilter({ kind: "recent" });
  };

  const title =
    filter.kind === "series" ? (data.seriesById.get(filter.id)?.title ?? "") : FILTER_LABEL[filter.kind];

  const badges = (p: StudioPhoto) => {
    const out: string[] = [];
    if (p.isPublished === false) out.push("非公開");
    if (filter.kind !== "hero" && data.heroSet.has(p.id)) out.push("トップ");
    if (filter.kind === "series" && data.seriesById.get(filter.id)?.coverPhotoId === p.id) out.push("表紙");
    return out;
  };

  const side = (f: Filter, label: string, count: number) => (
    <li>
      <button
        type="button"
        className="st-ax-btn st-side__item"
        aria-current={sameFilter(filter, f) ? "page" : undefined}
        onClick={() => setFilter(f)}
      >
        <span>{label}</span>
        <span className="st-side__count">{count}</span>
      </button>
    </li>
  );

  return (
    <div className="st-workspace" data-inspector={selection.length > 0 || undefined}>
      <nav className="st-side" aria-label="写真の絞り込み">
        <ul className="st-side__list">
          {side({ kind: "all" }, "すべての写真", counts.all)}
          {side({ kind: "loose" }, "シリーズに入っていない", counts.loose)}
          {side({ kind: "hidden" }, "非公開", counts.hidden)}
          {side({ kind: "hero" }, "トップに出す", counts.hero)}
          {counts.recent > 0 && side({ kind: "recent" }, "今回加えた", counts.recent)}
        </ul>
        <ul className="st-side__list st-side__list--quiet">
          {side({ kind: "film" }, "フィルム", counts.film)}
          {side({ kind: "digital" }, "デジタル", counts.digital)}
        </ul>
        <p className="st-side__label">シリーズ</p>
        <ul className="st-side__list">
          {data.series.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="st-ax-btn st-side__item"
                aria-current={filter.kind === "series" && filter.id === s.id ? "page" : undefined}
                data-drop={dropSeries === s.id || undefined}
                onClick={() => setFilter({ kind: "series", id: s.id })}
                onDragOver={(e) => {
                  if (!Array.from(e.dataTransfer.types).includes(DRAG_TYPE)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDropSeries(s.id);
                }}
                onDragLeave={() => setDropSeries((v) => (v === s.id ? null : v))}
                onDrop={(e) => void dropOnSeries(e, s.id)}
              >
                <span className="st-side__title">
                  <span className="st-side__text">{s.title}</span>
                  {s.isPublished === false && <span className="st-tag">非公開</span>}
                </span>
                <span className="st-side__count">{data.membersBySeries.get(s.id)?.length ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="st-side__foot">
          <button type="button" className="st-ax-btn st-link" onClick={() => setTrashOpen(true)}>
            ゴミ箱
          </button>
        </div>
      </nav>

      <div className="st-main" ref={scrollRef}>
        <div className="st-toolbar">
          <div className="st-toolbar__title">
            <h2>{title}</h2>
            <span className="st-toolbar__count">{visible.length}枚</span>
            {filter.kind === "series" && (
              <button type="button" className="st-ax-btn st-link" onClick={() => onOpenSeries(filter.id)}>
                シリーズを編集
              </button>
            )}
          </div>
          <div className="st-toolbar__tools">
            <input
              className="st-input st-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="探す（題・ファイル名・カメラ・2025-10）"
              aria-label="写真を探す"
            />
            <fieldset className="st-seg st-seg--small" aria-label="写真の大きさ">
              {(Object.keys(GRID_SIZES) as GridSize[]).map((k) => (
                <button key={k} type="button" aria-pressed={size === k} className="st-ax-btn st-seg__item" onClick={() => setSize(k)}>
                  {k === "s" ? "小" : k === "m" ? "中" : "大"}
                </button>
              ))}
            </fieldset>
            <button type="button" className="st-ax-btn st-button" aria-pressed={pickMode} onClick={() => setPickMode((v) => !v)}>
              {pickMode ? "選び終える" : "まとめて選ぶ"}
            </button>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => fileInput.current?.click()} disabled={upload !== null}>
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
                if (files.length) void startImport(files);
              }}
            />
          </div>
        </div>
        {!canReorder && filter.kind !== "hero" && query.trim() && (
          <p className="st-note st-note--bar">探している間は並べ替えできません。</p>
        )}
        {data.failed ? (
          <div className="st-empty">
            <p>写真を読み込めませんでした。</p>
            <button type="button" className="st-ax-btn st-button" onClick={data.retry}>
              もう一度読み込む
            </button>
          </div>
        ) : data.loading ? (
          <p className="st-empty">読み込んでいます…</p>
        ) : (
          <StudioGrid
            photos={visible}
            size={size}
            selected={selectedIds}
            onSelect={onSelect}
            pickMode={pickMode}
            canReorder={canReorder}
            onReorder={(moving, at) => void onReorder(moving, at)}
            onFiles={(files) => void startImport(files)}
            badges={badges}
            scrollRef={scrollRef}
            empty={
              query.trim() ? (
                <p>見つかりませんでした。</p>
              ) : filter.kind === "loose" ? (
                <p>どの写真もシリーズに入っています。</p>
              ) : filter.kind === "all" ? (
                <p>
                  まだ写真がありません。ここへ写真を落とすか、「写真を加える」から選んでください。
                </p>
              ) : (
                <p>この絞り込みに当たる写真はありません。</p>
              )
            }
          />
        )}
      </div>

      <Inspector
        data={data}
        selection={selection}
        seriesContext={filter.kind === "series" ? filter.id : undefined}
        onClear={clear}
        onOpenDetails={onOpenDetails}
      />

      {trashOpen && <TrashDialog onClose={() => setTrashOpen(false)} />}
    </div>
  );
}

type TrashPhoto = StudioPhoto & { deletedAt?: number | string | null };

function TrashDialog({ onClose }: { onClose: () => void }) {
  const { refresh, fail, say } = useStudio();
  const ref = useRef<HTMLDialogElement>(null);
  const trashQ = useQuery({
    queryKey: ["admin-trash"],
    queryFn: async () =>
      jsonOrThrow<{ photos: TrashPhoto[]; retentionDays: number }>(await adminApi.photos.trash.$get()),
  });
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // 管理画面の窓は data-phase="show" で現れる（styles.css の .admin-atelier dialog）。
    const f = requestAnimationFrame(() => d?.setAttribute("data-phase", "show"));
    return () => cancelAnimationFrame(f);
  }, []);
  const restore = async (ids: number[]) => {
    try {
      for (const id of ids) await restorePhoto(id);
      await Promise.all([refresh(), trashQ.refetch()]);
      say({ text: `${ids.length === 1 ? "" : `${ids.length}枚を`}戻しました` });
    } catch {
      fail("戻せませんでした。");
    }
  };
  const photos = trashQ.data?.photos ?? [];
  return (
    <dialog ref={ref} className="st-dialog" onClose={onClose} aria-label="ゴミ箱">
      <div className="st-dialog__head">
        <h2>ゴミ箱</h2>
        <p className="st-note">
          ここにある写真はサイトに出ません。{trashQ.data?.retentionDays ?? 30}日たつと自動で消えます。
        </p>
        <button type="button" className="st-ax-btn st-link" onClick={() => ref.current?.close()}>
          閉じる
        </button>
      </div>
      {trashQ.isLoading ? (
        <p className="st-empty">読み込んでいます…</p>
      ) : photos.length === 0 ? (
        <p className="st-empty">ゴミ箱は空です。</p>
      ) : (
        <>
          <ul className="st-trash">
            {photos.map((p) => (
              <li key={p.id} className="st-trash__item">
                <img src={adminPhotoSrc(p, 320, 60)} alt="" />
                <button type="button" className="st-ax-btn st-link" onClick={() => void restore([p.id])}>
                  戻す
                </button>
              </li>
            ))}
          </ul>
          <div className="st-dialog__foot">
            <button type="button" className="st-ax-btn st-button" onClick={() => void restore(photos.map((p) => p.id))}>
              すべて戻す
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
