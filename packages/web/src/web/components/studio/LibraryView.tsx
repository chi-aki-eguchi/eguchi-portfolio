import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api";
import { adminPhotoSrc, jsonOrThrow, usePersistentState } from "../../pages/admin-shared";
import { applyWorkOrder, idsBetween, moveManyTo } from "../../lib/work-order";
import { DRAG_TYPE, GRID_SIZES, StudioGrid, type GridSize } from "./StudioGrid";
import { Inspector } from "./Inspector";
import {
  matchesQuery,
  purgePhoto,
  reorderAllPhotos,
  reorderSeriesPhotos,
  restorePhoto,
  seriesPhotos,
  useStudio,
  type StudioData,
  type StudioPhoto,
} from "./studio-data";
import { adminText as tx } from "../../pages/admin-i18n";

type Filter =
  | { kind: "all" }
  | { kind: "loose" }
  | { kind: "hidden" }
  | { kind: "hero" }
  | { kind: "recent" }
  | { kind: "film" }
  | { kind: "digital" }
  | { kind: "series"; id: number };

// 見出しの言葉。管理画面の言語で変わるので、描くたびに引く。
const filterLabel = (kind: Exclude<Filter["kind"], "series">): string =>
  ({
    all: tx("すべての写真", "All photos"),
    loose: tx("シリーズに入っていない写真", "Photos not in a series"),
    hidden: tx("非公開の写真", "Hidden photos"),
    hero: tx("トップに出す写真", "Photos on the home page"),
    recent: tx("今回加えた写真", "Just added"),
    film: tx("フィルム", "Film"),
    digital: tx("デジタル", "Digital"),
  })[kind];

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
        remember({ label: tx("並び", "Order"), run: () => reorderSeriesPhotos(filter.id, before) }, tx("シリーズの中の並びを変えました", "Changed the order in the series"));
      } catch {
        await refresh();
        fail(tx("並びを保存できませんでした。最新の並びを読み直しました。", "Could not save the order. Reloaded the latest order."));
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
      remember({ label: tx("並び", "Order"), run: () => reorderAllPhotos(before, after) }, tx("サイトでの並びを変えました", "Changed the order on the site"));
    } catch (e) {
      await refresh();
      fail(
        e instanceof Error && e.message === "conflict"
          ? tx("別の画面で並びが変わっていました。最新の並びを読み直しました。", "The order was changed elsewhere. Reloaded the latest order.")
          : tx("並びを保存できませんでした。", "Could not save the order."),
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
      fail(tx(`もう「${name}」に入っています。`, `Already in “${name}”.`));
      return;
    }
    try {
      await seriesPhotos(seriesId, { add: ids });
      await refresh();
      remember(
        { label: tx("シリーズへ入れる", "Add to series"), run: () => seriesPhotos(seriesId, { remove: ids }) },
        tx(`${ids.length === 1 ? "" : `${ids.length}枚を`}「${name}」に入れました`, `Added ${ids.length === 1 ? "1 photo" : `${ids.length} photos`} to “${name}”`),
      );
    } catch {
      fail(tx("シリーズへ入れられませんでした。", "Could not add to the series."));
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
    filter.kind === "series" ? (data.seriesById.get(filter.id)?.title ?? "") : filterLabel(filter.kind);

  const badges = (p: StudioPhoto) => {
    const out: string[] = [];
    if (p.isPublished === false) out.push(tx("非公開", "Hidden"));
    if (filter.kind !== "hero" && data.heroSet.has(p.id)) out.push(tx("トップ", "Home"));
    if (filter.kind === "series" && data.seriesById.get(filter.id)?.coverPhotoId === p.id) out.push(tx("表紙", "Cover"));
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
      <nav className="st-side" aria-label={tx("写真の絞り込み", "Photo filters")}>
        <ul className="st-side__list">
          {side({ kind: "all" }, tx("すべての写真", "All photos"), counts.all)}
          {side({ kind: "loose" }, tx("シリーズに入っていない", "Not in a series"), counts.loose)}
          {side({ kind: "hidden" }, tx("非公開", "Hidden"), counts.hidden)}
          {side({ kind: "hero" }, tx("トップに出す", "On the home page"), counts.hero)}
          {counts.recent > 0 && side({ kind: "recent" }, tx("今回加えた", "Just added"), counts.recent)}
        </ul>
        <ul className="st-side__list st-side__list--quiet">
          {side({ kind: "film" }, tx("フィルム", "Film"), counts.film)}
          {side({ kind: "digital" }, tx("デジタル", "Digital"), counts.digital)}
        </ul>
        <p className="st-side__label">{tx("シリーズ", "Series")}</p>
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
                  {s.isPublished === false && <span className="st-tag">{tx("非公開", "Hidden")}</span>}
                </span>
                <span className="st-side__count">{data.membersBySeries.get(s.id)?.length ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="st-side__foot">
          <button type="button" className="st-ax-btn st-link" onClick={() => setTrashOpen(true)}>
            {tx("ゴミ箱", "Trash")}
          </button>
        </div>
      </nav>

      <div className="st-main" ref={scrollRef}>
        <div className="st-toolbar">
          <div className="st-toolbar__title">
            <h2>{title}</h2>
            <span className="st-toolbar__count">{tx(`${visible.length}枚`, `${visible.length}`)}</span>
            {filter.kind === "series" && (
              <button type="button" className="st-ax-btn st-link" onClick={() => onOpenSeries(filter.id)}>
                {tx("シリーズを編集", "Edit series")}
              </button>
            )}
          </div>
          <div className="st-toolbar__tools">
            <input
              className="st-input st-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx("題・ファイル名・カメラで探す", "Search title, file name, camera")}
              title={tx("題・ファイル名・カメラ・撮影年月（例 2025-10）で探せます", "Search by title, file name, camera or month (e.g. 2025-10)")}
              aria-label={tx("写真を探す", "Search photos")}
            />
            <fieldset className="st-seg st-seg--small" aria-label={tx("写真の大きさ", "Photo size")}>
              {(Object.keys(GRID_SIZES) as GridSize[]).map((k) => (
                <button key={k} type="button" aria-pressed={size === k} className="st-ax-btn st-seg__item" onClick={() => setSize(k)}>
                  {k === "s" ? tx("小", "S") : k === "m" ? tx("中", "M") : tx("大", "L")}
                </button>
              ))}
            </fieldset>
            <button type="button" className="st-ax-btn st-button" aria-pressed={pickMode} onClick={() => setPickMode((v) => !v)}>
              {pickMode ? tx("選び終える", "Done") : tx("まとめて選ぶ", "Select")}
            </button>
            <button type="button" className="st-ax-btn st-button st-button--primary" onClick={() => fileInput.current?.click()} disabled={upload !== null}>
              {tx("写真を加える", "Add photos")}
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
          <p className="st-note st-note--bar">{tx("探している間は並べ替えできません。", "Reordering is off while searching.")}</p>
        )}
        {data.failed ? (
          <div className="st-empty">
            <p>{tx("写真を読み込めませんでした。", "Could not load the photos.")}</p>
            <button type="button" className="st-ax-btn st-button" onClick={data.retry}>
              {tx("もう一度読み込む", "Try again")}
            </button>
          </div>
        ) : data.loading ? (
          <p className="st-empty">{tx("読み込んでいます…", "Loading…")}</p>
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
                <p>{tx("見つかりませんでした。", "Nothing found.")}</p>
              ) : filter.kind === "loose" ? (
                <p>{tx("どの写真もシリーズに入っています。", "Every photo is in a series.")}</p>
              ) : filter.kind === "all" ? (
                <p>
                  {tx("まだ写真がありません。ここへ写真を落とすか、「写真を加える」から選んでください。", "No photos yet. Drop photos here or choose them with “Add photos”.")}
                </p>
              ) : (
                <p>{tx("この絞り込みに当たる写真はありません。", "No photos match this filter.")}</p>
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
      jsonOrThrow<{ photos: TrashPhoto[] }>(await adminApi.photos.trash.$get()),
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
      say({ text: tx(`${ids.length === 1 ? "" : `${ids.length}枚を`}戻しました`, `Restored ${ids.length === 1 ? "1 photo" : `${ids.length} photos`}`) });
    } catch {
      fail(tx("戻せませんでした。", "Could not restore."));
    }
  };
  // 完全に削除（2026-09-30）。以前は説明に「完全削除してください」とあるのに、
  // この画面には戻すボタンしか無かった。元に戻せないので、必ず確かめてから消す。
  const [purgeIds, setPurgeIds] = useState<number[] | null>(null);
  const [purging, setPurging] = useState(false);
  const purge = async (ids: number[]) => {
    setPurging(true);
    let done = 0;
    try {
      for (const id of ids) {
        await purgePhoto(id);
        done += 1;
      }
      say({ text: tx(`${done === 1 ? "1枚" : `${done}枚`}を完全に削除しました`, `Permanently deleted ${done === 1 ? "1 photo" : `${done} photos`}`) });
    } catch {
      fail(
        done
          ? tx(`${done}枚だけ完全に削除しました。残りは消せませんでした。`, `Deleted only ${done}. The rest could not be deleted.`)
          : tx("完全に削除できませんでした。", "Could not delete permanently."),
      );
    } finally {
      setPurging(false);
      setPurgeIds(null);
      await Promise.all([refresh(), trashQ.refetch()]);
    }
  };
  const photos = trashQ.data?.photos ?? [];
  return (
    <dialog ref={ref} className="st-dialog" onClose={onClose} aria-label={tx("ゴミ箱", "Trash")}>
      <div className="st-dialog__head">
        <h2>{tx("ゴミ箱", "Trash")}</h2>
        <p className="st-note">
          {tx("ここにある写真はサイトに出ません。自動では消えず、保管中はストレージを使用します。復元するか、確認して完全削除してください。", "Photos here are not on the site. They are never removed automatically and keep using storage until you restore or permanently delete them.")}
        </p>
        <button type="button" className="st-ax-btn st-link" onClick={() => ref.current?.close()}>
          {tx("閉じる", "Close")}
        </button>
      </div>
      {trashQ.isLoading ? (
        <p className="st-empty">{tx("読み込んでいます…", "Loading…")}</p>
      ) : photos.length === 0 ? (
        <p className="st-empty">{tx("ゴミ箱は空です。", "The trash is empty.")}</p>
      ) : (
        <>
          <ul className="st-trash">
            {photos.map((p) => (
              <li key={p.id} className="st-trash__item" data-purge-target={purgeIds?.includes(p.id) || undefined}>
                <img src={adminPhotoSrc(p, 320, 60)} alt="" />
                <span className="st-trash__actions">
                  <button type="button" className="st-ax-btn st-link" onClick={() => void restore([p.id])} disabled={purging}>
                    {tx("戻す", "Restore")}
                  </button>
                  <button type="button" className="st-ax-btn st-link st-link--danger" onClick={() => setPurgeIds([p.id])} disabled={purging}>
                    {tx("完全に削除", "Delete")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="st-dialog__foot">
            {purgeIds ? (
              <span className="st-confirm st-confirm--inline" role="alert">
                {tx(
                  `${purgeIds.length === 1 ? "この写真" : `${purgeIds.length}枚`}を完全に削除しますか？元に戻せません。`,
                  `Permanently delete ${purgeIds.length === 1 ? "this photo" : `${purgeIds.length} photos`}? This cannot be undone.`,
                )}
                <button type="button" className="st-ax-btn st-button st-button--danger" disabled={purging} onClick={() => void purge(purgeIds)}>
                  {purging ? tx("削除しています…", "Deleting…") : tx("完全に削除する", "Delete permanently")}
                </button>
                <button type="button" className="st-ax-btn st-link" disabled={purging} onClick={() => setPurgeIds(null)}>
                  {tx("やめる", "Cancel")}
                </button>
              </span>
            ) : (
              <>
                <button type="button" className="st-ax-btn st-button" onClick={() => void restore(photos.map((p) => p.id))}>
                  {tx("すべて戻す", "Restore all")}
                </button>
                <button type="button" className="st-ax-btn st-button st-button--danger-outline" onClick={() => setPurgeIds(photos.map((p) => p.id))}>
                  {tx("すべて完全に削除…", "Delete all…")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
