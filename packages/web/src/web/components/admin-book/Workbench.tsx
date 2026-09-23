import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, adminApi } from "../../lib/api";
import {
  adminPhotoSrc,
  assertOk,
  jsonOrThrow,
  usePersistentState,
  type AdminSeries,
  type Photo,
} from "../../pages/admin-shared";
import { orientedDimensions } from "../../../shared/image-url";
import { mediumOf, mediumRuns, pad2, type Medium } from "../../lib/book";
import { applyWorkOrder, idsBetween, moveManyTo } from "../../lib/work-order";
import { uploadPhotoFile, type UploadMedium } from "../../lib/admin-upload";
import { isUploadableImageFile, imageFileTooLarge } from "../../lib/upload-file";
import "./admin-book.css";

type Work = AdminSeries & { kind?: string | null };
type WorkKey = number | "loose";

type UndoEntry = { label: string; run: () => Promise<void> };
type Notice = { text: string; undo?: UndoEntry; action?: { label: string; run: () => void } };
type Imported = { id: number; medium: UploadMedium; exifCamera: string; name: string };

const MEDIUM_LABEL: Record<Medium, string> = {
  film: "フィルム",
  digital: "デジタル",
  unknown: "媒体の記録なし",
};
const FILM = "フィルム";
const DIGITAL = "デジタル";

function slugFromTitle(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `work-${Date.now().toString(36)}`;
}

function shotLine(p: Photo): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.shotAt ?? "");
  if (!m) return null;
  const date = `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
  return mediumOf(p) === "film" ? `${date}にスキャン` : `${date}に撮影`;
}

/** 検索語に当たるか（ファイル名・題・カメラ・レンズ・日付「2025-10」「2025年10月」）。 */
function matches(p: Photo, q: string): boolean {
  if (!q) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.shotAt ?? "");
  const hay = [
    p.filename,
    p.title,
    p.camera ?? "",
    p.lens ?? "",
    p.shotAt ?? "",
    m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : "",
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

type MediumFilter = "all" | "film" | "digital";
type StateFilter = "all" | "public" | "hidden";

/**
 * 作品ごとの作業台（写真集の管理画面、2026-09-23 試作）。
 *
 * 左に作品、中央にその作品のベタ焼き（公開サイトの目次と同じ見た目）、
 * 右に選んでいるもの（写真・複数の写真・作品）の欄。**一番よく使う操作は
 * 「写真を加える」と「ドラッグで順番を変える」**なので、その2つだけを
 * 常に見せる。公開・表紙・移動・ゴミ箱は、写真を選んだときに右の欄に出る。
 *
 * 選び方: クリックで1枚、⌘（Ctrl）クリックで足す・外す、Shift クリックで範囲。
 * 指で使うときは「まとめて選ぶ」を押すと、押すたびに足す・外すになる。
 * どの操作も直後に「元に戻す」が出て、⌘Z でも戻せる。
 */
export function Workbench({
  onOpenLibrary,
  onImported,
  onUploadingChange,
}: {
  onOpenLibrary: () => void;
  onImported?: (ids: number[]) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const photosQ = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow<{ photos: Photo[] }>(await api.photos.$get({ query: { all: "1" } })),
  });
  const seriesQ = useQuery({
    queryKey: ["admin-series"],
    queryFn: async () => jsonOrThrow<{ series: Work[] }>(await adminApi.series.$get()),
  });

  const allPhotos = useMemo(
    () =>
      [...(photosQ.data?.photos ?? [])]
        .filter((p) => !p.deletedAt)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id),
    [photosQ.data],
  );
  const works = useMemo(
    () =>
      [...(seriesQ.data?.series ?? [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
      ),
    [seriesQ.data],
  );
  // 作品ごとの枚数と表紙は1回だけ数える（写真が2000枚でも作品の数ぶん回さない）。
  const byWork = useMemo(() => {
    const map = new Map<WorkKey, Photo[]>();
    for (const p of allPhotos) {
      const key: WorkKey = p.seriesId ?? "loose";
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return map;
  }, [allPhotos]);
  const photoById = useMemo(() => new Map(allPhotos.map((p) => [p.id, p])), [allPhotos]);

  const [storedKey, setStoredKey] = usePersistentState<WorkKey | null>(
    "admin:book:work",
    null,
    "local",
  );
  const activeKey: WorkKey | null =
    storedKey === "loose" || works.some((w) => w.id === storedKey)
      ? storedKey
      : (works[0]?.id ?? (works.length === 0 && allPhotos.length ? "loose" : null));
  const activeWork = typeof activeKey === "number" ? works.find((w) => w.id === activeKey) : undefined;
  const workPhotos = useMemo(
    () => (activeKey === null ? [] : (byWork.get(activeKey) ?? [])),
    [byWork, activeKey],
  );
  const workIndex = useMemo(() => new Map(workPhotos.map((p, i) => [p.id, i])), [workPhotos]);

  // ── 探す・絞り込む ─────────────────────────────────
  const [query, setQuery] = useState("");
  const [mediumFilter, setMediumFilter] = useState<MediumFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const filtering = query.trim() !== "" || mediumFilter !== "all" || stateFilter !== "all";
  const visible = useMemo(
    () =>
      filtering
        ? workPhotos.filter(
            (p) =>
              matches(p, query.trim()) &&
              (mediumFilter === "all" || mediumOf(p) === mediumFilter) &&
              (stateFilter === "all" ||
                (stateFilter === "hidden" ? p.isPublished === false : p.isPublished !== false)),
          )
        : workPhotos,
    [workPhotos, filtering, query, mediumFilter, stateFilter],
  );

  // ── 選ぶ ────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const anchorRef = useRef<number | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const selection = useMemo(
    () => workPhotos.filter((p) => selectedIds.has(p.id)),
    [workPhotos, selectedIds],
  );
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);
  useEffect(() => {
    clearSelection();
    setQuery("");
    setMediumFilter("all");
    setStateFilter("all");
    setPickMode(false);
  }, [activeKey, clearSelection]);
  const onFrameClick = (p: Photo, e: React.MouseEvent) => {
    const visibleIds = visible.map((x) => x.id);
    if (e.shiftKey && anchorRef.current !== null) {
      const range = idsBetween(visibleIds, anchorRef.current, p.id);
      setSelectedIds((prev) => new Set([...(e.metaKey || e.ctrlKey ? prev : []), ...range]));
      return;
    }
    anchorRef.current = p.id;
    if (e.metaKey || e.ctrlKey || pickMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(p.id)) next.delete(p.id);
        else next.add(p.id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) =>
      prev.size === 1 && prev.has(p.id) ? new Set() : new Set([p.id]),
    );
  };

  // ── 通知と取り消し ─────────────────────────────────
  const [notice, setNotice] = useState<Notice | null>(null);
  const undoStack = useRef<UndoEntry[]>([]);
  const noticeTimer = useRef<number | undefined>(undefined);
  const say = useCallback((n: Notice) => {
    setNotice(n);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), n.undo || n.action ? 10000 : 5000);
  }, []);
  const remember = useCallback(
    (entry: UndoEntry, text: string) => {
      undoStack.current.push(entry);
      say({ text, undo: entry });
    },
    [say],
  );
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["photos"] }),
      qc.invalidateQueries({ queryKey: ["admin-series"] }),
      qc.invalidateQueries({ queryKey: ["series"] }),
      qc.invalidateQueries({ queryKey: ["works"] }),
    ]);
  }, [qc]);
  const fail = useCallback((text: string) => say({ text }), [say]);
  const runUndo = useCallback(
    async (entry?: UndoEntry) => {
      const target = entry ?? undoStack.current.pop();
      if (!target) return;
      undoStack.current = undoStack.current.filter((e) => e !== target);
      try {
        await target.run();
        await refresh();
        say({ text: `元に戻しました（${target.label}）` });
      } catch {
        fail("元に戻せませんでした。最新の状態を読み直しました。");
        await refresh();
      }
    },
    [fail, refresh, say],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (e.key === "Escape" && !typing && !document.querySelector("dialog[open]")) {
        clearSelection();
        return;
      }
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      if (typing || undoStack.current.length === 0) return;
      e.preventDefault();
      void runUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runUndo, clearSelection]);

  // ── 書き込み ────────────────────────────────────────
  const saveOrder = useCallback(
    async (ids: number[], expectedIds: number[]) => {
      const res = await adminApi.photos.reorder.$post({ json: { ids, expectedIds } });
      if (res.status === 409) {
        await refresh();
        throw new Error("conflict");
      }
      assertOk(res);
    },
    [refresh],
  );
  /** 作品の中で `moving` を `toIndex` 番目（0 始まり、移したあとの並び）へ。 */
  const moveInWork = useCallback(
    async (moving: number[], toIndex: number) => {
      const before = allPhotos.map((p) => p.id);
      const nextWork = moveManyTo(workPhotos.map((p) => p.id), moving, toIndex);
      const after = applyWorkOrder(before, nextWork);
      if (after.join() === before.join()) return;
      const rank = new Map(after.map((id, i) => [id, i]));
      qc.setQueryData<{ photos: Photo[] }>(["photos", "all"], (old) =>
        old
          ? { photos: old.photos.map((p) => (rank.has(p.id) ? { ...p, sortOrder: rank.get(p.id)! } : p)) }
          : old,
      );
      try {
        await saveOrder(after, before);
        const first = nextWork.indexOf(moving.find((id) => nextWork.includes(id))!) + 1;
        remember(
          { label: "順番の変更", run: () => saveOrder(before, after) },
          moving.length === 1
            ? `${pad2(first)} 番目へ動かしました`
            : `${moving.length}枚を ${pad2(first)} 番目からに並べました`,
        );
        void refresh();
      } catch (e) {
        fail(
          e instanceof Error && e.message === "conflict"
            ? "別の画面で順番が変わっていました。最新の順番を読み直しました。"
            : "順番を保存できませんでした。もう一度お試しください。",
        );
        await refresh();
      }
    },
    [allPhotos, workPhotos, qc, saveOrder, remember, refresh, fail],
  );
  const patchPhoto = useCallback(async (id: number, body: Partial<Photo>) => {
    const res = await adminApi.photos[":id"].$patch({ param: { id: String(id) }, json: body });
    assertOk(res);
  }, []);
  const batch = useCallback(async (ids: number[], operation: string, value?: unknown) => {
    if (ids.length === 0) return;
    const res = await adminApi.photos.batch.$post({ json: { ids, operation, value } });
    assertOk(res);
  }, []);
  const patchWork = useCallback(async (id: number, body: Record<string, unknown>) => {
    const res = await adminApi.series[":id"].$patch({ param: { id: String(id) }, json: body });
    assertOk(res);
  }, []);

  const setPublished = async (photos: Photo[], publish: boolean) => {
    const changing = photos.filter((p) => (p.isPublished !== false) !== publish);
    if (changing.length === 0) return;
    const ids = changing.map((p) => p.id);
    try {
      await batch(ids, publish ? "publish" : "unpublish");
      await refresh();
      remember(
        { label: publish ? "公開" : "非公開", run: () => batch(ids, publish ? "unpublish" : "publish") },
        publish
          ? `${ids.length === 1 ? "" : `${ids.length}枚を`}公開しました`
          : `${ids.length === 1 ? "" : `${ids.length}枚を`}非公開にしました（サイトに出ません）`,
      );
    } catch {
      fail("公開の設定を保存できませんでした。");
    }
  };
  const moveToWork = async (photos: Photo[], target: WorkKey) => {
    const to = target === "loose" ? null : target;
    const moving = photos.filter((p) => (p.seriesId ?? null) !== to);
    if (moving.length === 0) return;
    const groups = new Map<number | null, number[]>();
    for (const p of moving) {
      const from = p.seriesId ?? null;
      groups.set(from, [...(groups.get(from) ?? []), p.id]);
    }
    try {
      await batch(moving.map((p) => p.id), "series", to);
      await refresh();
      const name = target === "loose" ? "未整理" : (works.find((w) => w.id === target)?.title ?? "");
      remember(
        {
          label: "作品の移動",
          run: async () => {
            for (const [from, ids] of groups) await batch(ids, "series", from);
          },
        },
        `${moving.length === 1 ? "" : `${moving.length}枚を`}「${name}」へ移しました`,
      );
      clearSelection();
    } catch {
      fail("作品を移せませんでした。");
    }
  };
  const setCover = async (p: Photo) => {
    if (!activeWork) return;
    const before = activeWork.coverPhotoId ?? null;
    try {
      await patchWork(activeWork.id, { coverPhotoId: p.id });
      await refresh();
      remember(
        { label: "表紙の変更", run: () => patchWork(activeWork.id, { coverPhotoId: before }) },
        "この写真を表紙にしました",
      );
    } catch {
      fail("表紙を保存できませんでした。");
    }
  };
  const trash = async (photos: Photo[]) => {
    const done: number[] = [];
    try {
      for (const p of photos) {
        const res = await adminApi.photos[":id"].$delete({ param: { id: String(p.id) } });
        assertOk(res);
        done.push(p.id);
      }
    } catch {
      fail(done.length ? `${done.length}枚だけゴミ箱へ移しました。` : "ゴミ箱へ移せませんでした。");
    }
    if (done.length === 0) return;
    await refresh();
    clearSelection();
    remember(
      {
        label: "ゴミ箱への移動",
        run: async () => {
          for (const id of done) {
            const r = await adminApi.photos[":id"].restore.$post({ param: { id: String(id) } });
            assertOk(r);
          }
        },
      },
      `${done.length === 1 ? "" : `${done.length}枚を`}ゴミ箱へ移しました（30日間は戻せます）`,
    );
  };

  // ── 作品どうしの順番 ───────────────────────────────
  const reorderWorks = async (dragId: number, targetId: number) => {
    const before = works.map((w) => w.id);
    const from = before.indexOf(dragId);
    const to = before.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const after = [...before];
    after.splice(from, 1);
    after.splice(to, 0, dragId);
    const save = async (ids: number[], expectedIds: number[]) => {
      const res = await adminApi.series.reorder.$post({ json: { ids, expectedIds } });
      if (res.status === 409) {
        await refresh();
        throw new Error("conflict");
      }
      assertOk(res);
    };
    const rank = new Map(after.map((id, i) => [id, i]));
    qc.setQueryData<{ series: Work[] }>(["admin-series"], (old) =>
      old ? { series: old.series.map((w) => ({ ...w, sortOrder: rank.get(w.id) ?? w.sortOrder })) } : old,
    );
    try {
      await save(after, before);
      await refresh();
      remember({ label: "作品の順番", run: () => save(before, after) }, "作品の順番を変えました");
    } catch {
      fail("作品の順番を保存できませんでした。最新の順番を読み直しました。");
      await refresh();
    }
  };

  // ── 取り込み ────────────────────────────────────────
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [review, setReview] = useState<Imported[] | null>(null);
  useEffect(() => onUploadingChange?.(uploading !== null), [uploading, onUploadingChange]);
  const startImport = async (files: File[]) => {
    const usable = files.filter((f) => isUploadableImageFile(f) && !imageFileTooLarge(f));
    const skipped = files.length - usable.length;
    if (usable.length === 0) {
      fail("取り込める画像がありませんでした（JPEG・PNG・HEIC など、容量の上限内の画像）。");
      return;
    }
    const target = activeKey;
    setUploading({ done: 0, total: usable.length });
    const added: Imported[] = [];
    let duplicates = 0;
    let failed = 0;
    const queue = [...usable];
    let done = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, queue.length) }, async () => {
        let f: File | undefined;
        while ((f = queue.shift())) {
          // 媒体はカメラの記録から自動で決める。違っていたら取り込み後の一覧で直す。
          const r = await uploadPhotoFile(f, { medium: "auto", datePolicy: "exif" });
          if (r.kind === "added") {
            added.push({ id: r.id, medium: r.medium, exifCamera: r.exifCamera, name: f.name });
          } else if (r.kind === "duplicate") duplicates += 1;
          else failed += 1;
          done += 1;
          setUploading({ done, total: usable.length });
        }
      }),
    );
    if (typeof target === "number" && added.length) {
      try {
        await batch(added.map((a) => a.id), "series", target);
      } catch {
        /* 作品への割り当てに失敗しても写真は残る（未整理に出る） */
      }
    }
    setUploading(null);
    await refresh();
    onImported?.(added.map((a) => a.id));
    const parts = [`${added.length}枚を加えました`];
    if (duplicates) parts.push(`${duplicates}枚は登録済みのため飛ばしました`);
    if (failed) parts.push(`${failed}枚は取り込めませんでした`);
    if (skipped) parts.push(`${skipped}件は画像ではないか大きすぎました`);
    say({ text: parts.join(" · ") });
    if (added.length) setReview(added);
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const onDragOverSheet = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDropActive(true);
  };
  const onDropSheet = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) void startImport(files);
  };

  // ── ドラッグ（コマ・作品） ─────────────────────────────
  const [dragPhotoId, setDragPhotoId] = useState<number | null>(null);
  const [overPhotoId, setOverPhotoId] = useState<number | null>(null);
  const [dragWorkId, setDragWorkId] = useState<number | null>(null);
  const [overWorkId, setOverWorkId] = useState<number | null>(null);
  const endDrag = () => {
    setDragPhotoId(null);
    setOverPhotoId(null);
    setDragWorkId(null);
    setOverWorkId(null);
  };
  const draggedPhotos = (): Photo[] => {
    if (dragPhotoId === null) return [];
    return selectedIds.has(dragPhotoId) ? selection : [photoById.get(dragPhotoId)!].filter(Boolean);
  };
  const dropOnFrame = (target: Photo) => {
    const moving = draggedPhotos().map((p) => p.id);
    endDrag();
    if (moving.length === 0 || moving.includes(target.id)) return;
    const fromIdx = workIndex.get(moving[0]!) ?? 0;
    const targetIdx = workIndex.get(target.id) ?? 0;
    const rest = workPhotos.map((p) => p.id).filter((id) => !moving.includes(id));
    const toIndex = rest.indexOf(target.id) + (fromIdx < targetIdx ? 1 : 0);
    void moveInWork(moving, toIndex);
  };
  const dropOnWork = (key: WorkKey) => {
    if (dragWorkId !== null && typeof key === "number") {
      const id = dragWorkId;
      endDrag();
      void reorderWorks(id, key);
      return;
    }
    const photos = draggedPhotos();
    endDrag();
    if (photos.length) void moveToWork(photos, key);
  };

  // ── 新しい作品 ──────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const createWork = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const res = await adminApi.series.$post({
        json: { title, slug: slugFromTitle(title), kind: "series", isPublished: false },
      });
      assertOk(res);
      const body = (await res.json()) as { series?: { id?: number } };
      await refresh();
      if (typeof body.series?.id === "number") setStoredKey(body.series.id);
      setCreating(false);
      setNewTitle("");
      say({ text: `「${title}」を作りました（まだ非公開です）` });
    } catch {
      fail("作品を作れませんでした。同じ名前の作品がないか確かめてください。");
    }
  };

  const loading = photosQ.isLoading || seriesQ.isLoading;
  const shelves: { key: string; label: string; items: Work[] }[] = [
    { key: "series", label: "Series", items: works.filter((w) => w.kind !== "work") },
    { key: "work", label: "Work", items: works.filter((w) => w.kind === "work") },
  ];
  const coverFor = (w: Work) =>
    (w.coverPhotoId != null ? photoById.get(w.coverPhotoId) : undefined) ?? byWork.get(w.id)?.[0];
  const title = activeKey === "loose" ? "未整理の写真" : (activeWork?.title ?? "");
  const publishedCount = workPhotos.filter((p) => p.isPublished !== false).length;
  const single = selection.length === 1 ? selection[0]! : null;
  const visibleRuns = useMemo(() => mediumRuns(visible), [visible]);

  const workRow = (w: Work) => {
    const cover = coverFor(w);
    return (
      <li key={w.id}>
        <button
          type="button"
          className="bk-ax-btn bench-work"
          aria-current={activeKey === w.id ? "true" : undefined}
          data-drop={overWorkId === w.id ? "" : undefined}
          draggable
          onClick={() => setStoredKey(w.id)}
          onDragStart={(e) => {
            setDragWorkId(w.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", `work:${w.id}`);
          }}
          onDragOver={(e) => {
            if (dragPhotoId === null && dragWorkId === null) return;
            e.preventDefault();
            setOverWorkId(w.id);
          }}
          onDragLeave={() => setOverWorkId(null)}
          onDrop={(e) => {
            e.preventDefault();
            dropOnWork(w.id);
          }}
          onDragEnd={endDrag}
          title="ドラッグで作品の順番を変えられます。写真をここへ落とすと、この作品へ移ります。"
        >
          <span className="bench-work__thumb" aria-hidden="true">
            {cover && <img src={adminPhotoSrc(cover, 200, 70)} alt="" loading="lazy" />}
          </span>
          <span className="bench-work__name font-ja">{w.title || w.slug}</span>
          <span className="bench-work__count font-en">{byWork.get(w.id)?.length ?? 0}</span>
          {w.isPublished === false && <span className="bench-work__state">非公開</span>}
        </button>
      </li>
    );
  };

  return (
    <div
      className="bench"
      data-has-selection={selection.length ? "" : undefined}
      data-multi={selection.length > 1 || pickMode ? "" : undefined}
    >
      {/* 作品 */}
      <nav className="bench-works" aria-label="作品">
        {shelves.map((shelf) =>
          shelf.items.length ? (
            <div key={shelf.key} className="bench-works__shelf">
              <p className="bench-works__shelf-label font-en">{shelf.label}</p>
              <ul>{shelf.items.map(workRow)}</ul>
            </div>
          ) : null,
        )}
        <div className="bench-works__shelf">
          <ul>
            <li>
              <button
                type="button"
                className="bk-ax-btn bench-work bench-work--loose"
                aria-current={activeKey === "loose" ? "true" : undefined}
                data-drop={overWorkId === -1 ? "" : undefined}
                onClick={() => setStoredKey("loose")}
                onDragOver={(e) => {
                  if (dragPhotoId === null) return;
                  e.preventDefault();
                  setOverWorkId(-1);
                }}
                onDragLeave={() => setOverWorkId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOnWork("loose");
                }}
              >
                <span className="bench-work__thumb" aria-hidden="true" />
                <span className="bench-work__name font-ja">未整理</span>
                <span className="bench-work__count font-en">{byWork.get("loose")?.length ?? 0}</span>
              </button>
            </li>
          </ul>
          {creating ? (
            <form
              className="bench-new"
              onSubmit={(e) => {
                e.preventDefault();
                void createWork();
              }}
            >
              <label className="sr-only" htmlFor="bench-new-title">新しい作品の題</label>
              <input
                id="bench-new-title"
                ref={(el) => el?.focus()}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="作品の題"
                className="bench-input"
              />
              <div className="bench-new__actions">
                <button type="submit" className="bk-ax-btn bench-btn bench-btn--primary" disabled={!newTitle.trim()}>
                  作る
                </button>
                <button type="button" className="bk-ax-btn bench-btn" onClick={() => setCreating(false)}>
                  やめる
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="bk-ax-btn bench-works__new" onClick={() => setCreating(true)}>
              ＋ 新しい作品
            </button>
          )}
          <p className="bench-works__hint">作品はドラッグで並べ替えられます。</p>
        </div>
      </nav>

      {/* ベタ焼き */}
      <div
        className="bench-sheet"
        data-drop-active={dropActive ? "" : undefined}
        onDragOver={onDragOverSheet}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropActive(false);
        }}
        onDrop={onDropSheet}
      >
        <header className="bench-sheet__head">
          <div className="bench-sheet__titles">
            <h1 className="bench-sheet__title font-ja">{title}</h1>
            <p className="bench-sheet__meta">
              {workPhotos.length}枚
              {activeKey !== "loose" && workPhotos.length > 0 && (
                <> · 公開 {publishedCount} / 非公開 {workPhotos.length - publishedCount}</>
              )}
              {activeWork?.isPublished === false && <> · この作品は非公開</>}
            </p>
          </div>
          <div className="bench-sheet__actions">
            {activeWork && activeWork.isPublished !== false && (
              <a
                className="bench-link"
                href={`/${activeWork.kind === "work" ? "work" : "series"}/${activeWork.slug}`}
                target="_blank"
                rel="noopener"
              >
                サイトで見る ↗
              </a>
            )}
            <button
              type="button"
              className="bk-ax-btn bench-btn bench-btn--primary"
              onClick={() => fileInput.current?.click()}
              disabled={uploading !== null}
            >
              写真を加える
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void startImport(files);
              }}
            />
          </div>
        </header>

        {workPhotos.length > 0 && (
          <div className="bench-filter">
            <label className="bench-filter__search">
              <span className="sr-only">この作品の中を探す</span>
              <input
                type="search"
                className="bench-input"
                placeholder="探す（ファイル名・題・カメラ・2025-10 など）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              className="bench-input bench-filter__select"
              aria-label="媒体で絞り込む"
              value={mediumFilter}
              onChange={(e) => setMediumFilter(e.target.value as MediumFilter)}
            >
              <option value="all">フィルムもデジタルも</option>
              <option value="film">フィルムだけ</option>
              <option value="digital">デジタルだけ</option>
            </select>
            <select
              className="bench-input bench-filter__select"
              aria-label="公開の状態で絞り込む"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            >
              <option value="all">公開も非公開も</option>
              <option value="public">公開だけ</option>
              <option value="hidden">非公開だけ</option>
            </select>
            <button
              type="button"
              className="bk-ax-btn bench-btn"
              aria-pressed={pickMode}
              onClick={() => setPickMode((v) => !v)}
            >
              {pickMode ? "まとめて選ぶのを終える" : "まとめて選ぶ"}
            </button>
            {(pickMode || selection.length > 0 || filtering) && (
              <button
                type="button"
                className="bk-ax-btn bench-link"
                onClick={() => setSelectedIds(new Set(visible.map((p) => p.id)))}
              >
                {filtering ? `見えている${visible.length}枚を選ぶ` : "すべて選ぶ"}
              </button>
            )}
          </div>
        )}

        <p className="bench-sheet__hint">
          {filtering
            ? `${visible.length}枚が当てはまります。絞り込み中はドラッグで並べ替えできません（右の欄の「何番目へ」で移せます）。`
            : workPhotos.length > 1
              ? "コマをドラッグするとサイトの順番が変わります。⌘クリックで足す、Shiftクリックで範囲をまとめて選べます。写真をここへ落とすと、この作品に加わります。"
              : "写真をここへ落とすか「写真を加える」から選ぶと、この作品に加わります。"}
        </p>

        {loading && <p className="bench-empty">読み込んでいます…</p>}
        {!loading && workPhotos.length === 0 && (
          <div className="bench-empty">
            <p className="font-ja">まだ写真がありません。</p>
            <p>パソコンのフォルダから、ここへ写真をまとめて落としてください。</p>
          </div>
        )}

        <div className="bench-frames">
          {visibleRuns.map((run) => (
            <div key={`${run.medium}-${run.start}`} className="bench-run" data-medium={run.medium}>
              <p className="bench-run__label">
                {MEDIUM_LABEL[run.medium]} {run.photos.length}
              </p>
              <ol className="bench-run__frames">
                {run.photos.map((p) => {
                  const index = workIndex.get(p.id) ?? 0;
                  const dims = orientedDimensions(p.width, p.height, p.rotationDeg);
                  const ar = dims.width && dims.height ? dims.width / dims.height : 0.8;
                  const isCover = activeWork?.coverPhotoId === p.id;
                  const isSelected = selectedIds.has(p.id);
                  const dragIdx = dragPhotoId !== null ? (workIndex.get(dragPhotoId) ?? -1) : -1;
                  return (
                    <li
                      key={p.id}
                      className="bench-frame"
                      data-selected={isSelected ? "" : undefined}
                      data-hidden={p.isPublished === false ? "" : undefined}
                      data-dragging={
                        dragPhotoId !== null && (dragPhotoId === p.id || (selectedIds.has(dragPhotoId) && isSelected))
                          ? ""
                          : undefined
                      }
                      data-drop={
                        overPhotoId === p.id && dragPhotoId !== null && dragPhotoId !== p.id
                          ? dragIdx < index
                            ? "after"
                            : "before"
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="bk-ax-btn bench-frame__btn"
                        draggable
                        onDragStart={(e) => {
                          setDragPhotoId(p.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(p.id));
                        }}
                        onDragOver={(e) => {
                          if (dragPhotoId === null || filtering) return;
                          e.preventDefault();
                          setOverPhotoId(p.id);
                        }}
                        onDrop={(e) => {
                          if (dragPhotoId === null || filtering) return;
                          e.preventDefault();
                          e.stopPropagation();
                          dropOnFrame(p);
                        }}
                        onDragEnd={endDrag}
                        onClick={(e) => onFrameClick(p, e)}
                        aria-pressed={isSelected}
                        aria-label={`${pad2(index + 1)}番目の写真${p.isPublished === false ? "（非公開）" : ""}${isCover ? "（表紙）" : ""}`}
                      >
                        <span
                          className="bench-frame__img"
                          style={{ "--ar": String(ar) } as React.CSSProperties}
                        >
                          <img
                            src={adminPhotoSrc(p, 400, 72)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </span>
                        <span className="bench-frame__num font-en">
                          {pad2(index + 1)}
                          {isCover && <span className="bench-frame__tag">表紙</span>}
                          {p.isPublished === false && <span className="bench-frame__tag">非公開</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>

        {dropActive && (
          <div className="bench-dropcover" aria-hidden="true">
            <p className="font-ja">ここで離すと「{title}」に加わります</p>
          </div>
        )}
      </div>

      {/* 右の欄 */}
      <aside
        className="bench-side"
        aria-label={single ? "選んだ写真" : selection.length ? "選んだ写真（複数）" : "作品の設定"}
      >
        {single ? (
          <PhotoPanel
            key={single.id}
            photo={single}
            index={workIndex.get(single.id) ?? 0}
            total={workPhotos.length}
            works={works}
            activeKey={activeKey}
            isCover={activeWork?.coverPhotoId === single.id}
            canCover={Boolean(activeWork)}
            onClose={clearSelection}
            onPublish={(v) => void setPublished([single], v)}
            onMoveTo={(pos) => void moveInWork([single.id], pos)}
            onMoveWork={(key) => void moveToWork([single], key)}
            onCover={() => void setCover(single)}
            onTrash={() => void trash([single])}
            onMedium={async (m) => {
              const before = single.filmType ?? null;
              try {
                await batch([single.id], "filmType", m);
                await refresh();
                remember({ label: "媒体の変更", run: () => batch([single.id], "filmType", before) }, `${m}にしました`);
              } catch {
                fail("媒体を保存できませんでした。");
              }
            }}
            onSaveTitle={async (value) => {
              const before = single.title ?? "";
              if (value === before) return;
              try {
                await patchPhoto(single.id, { title: value });
                await refresh();
                remember({ label: "題の変更", run: () => patchPhoto(single.id, { title: before }) }, "題を保存しました");
              } catch {
                fail("題を保存できませんでした。");
              }
            }}
            onOpenLibrary={onOpenLibrary}
          />
        ) : selection.length > 1 ? (
          <MultiPanel
            photos={selection}
            total={workPhotos.length}
            works={works}
            activeKey={activeKey}
            onClose={clearSelection}
            onPublish={(v) => void setPublished(selection, v)}
            onMoveTo={(pos) => void moveInWork(selection.map((p) => p.id), pos)}
            onMoveWork={(key) => void moveToWork(selection, key)}
            onTrash={() => void trash(selection)}
          />
        ) : activeWork ? (
          <WorkPanel
            key={activeWork.id}
            work={activeWork}
            cover={coverFor(activeWork)}
            onSave={async (body) => {
              const before = {
                title: activeWork.title,
                subtitle: activeWork.subtitle ?? "",
                statement: activeWork.statement ?? "",
                isPublished: activeWork.isPublished !== false,
                kind: activeWork.kind === "work" ? "work" : "series",
              };
              try {
                await patchWork(activeWork.id, body);
                await refresh();
                remember({ label: "作品の設定", run: () => patchWork(activeWork.id, before) }, "作品の設定を保存しました");
              } catch {
                fail("作品の設定を保存できませんでした。");
              }
            }}
          />
        ) : (
          <div className="bench-panel">
            <p className="bench-panel__lede font-ja">
              どの作品にも入っていない写真です。写真を選んで「別の作品へ移す」か、左の作品の上へドラッグしてください。
              ⌘クリック・Shiftクリックでまとめて選べます。
            </p>
          </div>
        )}
      </aside>

      {review && (
        <ImportReview
          items={review}
          photoById={photoById}
          onClose={() => setReview(null)}
          onChange={async (changes) => {
            const toFilm = changes.filter((c) => c.medium === "film").map((c) => c.id);
            const toDigital = changes.filter((c) => c.medium === "digital");
            try {
              await batch(toFilm, "filmType", FILM);
              // フィルムにしたものは、複写に使ったカメラの名前を外す。
              for (const id of toFilm) await patchPhoto(id, { camera: "" });
              await batch(toDigital.map((c) => c.id), "filmType", DIGITAL);
              for (const c of toDigital) if (c.exifCamera) await patchPhoto(c.id, { camera: c.exifCamera });
              await refresh();
              say({ text: `${changes.length}枚の媒体を直しました` });
            } catch {
              fail("媒体を保存できませんでした。写真の一覧の「媒体」から直せます。");
            }
            setReview(null);
          }}
        />
      )}

      <output className="bench-notice" aria-live="polite">
        {uploading ? (
          <p>取り込み中 {uploading.done} / {uploading.total}</p>
        ) : notice ? (
          <p>
            {notice.text}
            {notice.undo && (
              <button type="button" className="bk-ax-btn bench-notice__undo" onClick={() => void runUndo(notice.undo)}>
                元に戻す
              </button>
            )}
            {notice.action && (
              <button type="button" className="bk-ax-btn bench-notice__undo" onClick={notice.action.run}>
                {notice.action.label}
              </button>
            )}
          </p>
        ) : null}
      </output>
    </div>
  );
}

/** 「何番目へ」。1〜total の番号で、その位置へ移す（101枚でも1回で）。 */
function PositionField({
  current,
  total,
  count,
  onMove,
}: {
  current: number | null;
  total: number;
  count: number;
  onMove: (toIndex: number) => void;
}) {
  const [value, setValue] = useState(current === null ? "" : String(current + 1));
  useEffect(() => setValue(current === null ? "" : String(current + 1)), [current]);
  const max = Math.max(1, total - count + 1);
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= max && (current === null || n !== current + 1);
  return (
    <form
      className="bench-position"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onMove(n - 1);
      }}
    >
      <label className="bench-field">
        <span>{count > 1 ? `選んだ${count}枚を、何番目から並べるか` : "何番目へ移すか"}（1〜{max}）</span>
        <span className="bench-position__row">
          <input
            className="bench-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button type="submit" className="bk-ax-btn bench-btn" disabled={!valid}>
            移す
          </button>
        </span>
      </label>
      <span className="bench-row">
        <button type="button" className="bk-ax-btn bench-btn" onClick={() => onMove(0)} disabled={current === 0}>
          先頭へ
        </button>
        <button type="button" className="bk-ax-btn bench-btn" onClick={() => onMove(max - 1)} disabled={current === max - 1}>
          最後へ
        </button>
      </span>
    </form>
  );
}

function PublishSwitch({ published, onChange, mixed }: { published: boolean; mixed?: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="bench-switch">
      <legend className="sr-only">サイトに出すか</legend>
      <button type="button" className="bk-ax-btn" aria-pressed={!mixed && published} onClick={() => onChange(true)}>
        公開
      </button>
      <button type="button" className="bk-ax-btn" aria-pressed={!mixed && !published} onClick={() => onChange(false)}>
        非公開
      </button>
    </fieldset>
  );
}

function WorkSelect({ works, activeKey, onMoveWork }: { works: Work[]; activeKey: WorkKey | null; onMoveWork: (key: WorkKey) => void }) {
  return (
    <label className="bench-field">
      <span>別の作品へ移す</span>
      <select
        className="bench-input"
        value={activeKey === null ? "" : String(activeKey)}
        onChange={(e) => onMoveWork(e.target.value === "loose" ? "loose" : Number(e.target.value))}
      >
        {works.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title || w.slug}
          </option>
        ))}
        <option value="loose">未整理</option>
      </select>
    </label>
  );
}

function PhotoPanel({
  photo,
  index,
  total,
  works,
  activeKey,
  isCover,
  canCover,
  onClose,
  onPublish,
  onMoveTo,
  onMoveWork,
  onCover,
  onTrash,
  onMedium,
  onSaveTitle,
  onOpenLibrary,
}: {
  photo: Photo;
  index: number;
  total: number;
  works: Work[];
  activeKey: WorkKey | null;
  isCover: boolean;
  canCover: boolean;
  onClose: () => void;
  onPublish: (v: boolean) => void;
  onMoveTo: (toIndex: number) => void;
  onMoveWork: (key: WorkKey) => void;
  onCover: () => void;
  onTrash: () => void;
  onMedium: (m: string) => void;
  onSaveTitle: (value: string) => Promise<void>;
  onOpenLibrary: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(photo.title ?? "");
  useEffect(() => setTitleDraft(photo.title ?? ""), [photo.id, photo.title]);
  const medium = mediumOf(photo);
  const facts = [photo.camera || null, shotLine(photo)].filter(Boolean);
  return (
    <div className="bench-panel">
      <div className="bench-panel__head">
        <p className="bench-panel__kicker font-en">
          {pad2(index + 1)} / {pad2(total)}
        </p>
        <button type="button" className="bk-ax-btn bench-link" onClick={onClose}>
          閉じる
        </button>
      </div>
      <img className="bench-panel__photo" src={adminPhotoSrc(photo, 800, 80)} alt="" />
      {facts.length > 0 && <p className="bench-panel__facts">{facts.join(" · ")}</p>}
      <p className="bench-panel__file">{photo.filename}</p>

      <PublishSwitch published={photo.isPublished !== false} onChange={onPublish} />
      <fieldset className="bench-switch">
        <legend className="sr-only">媒体</legend>
        <button type="button" className="bk-ax-btn" aria-pressed={medium === "film"} onClick={() => medium !== "film" && onMedium(FILM)}>
          フィルム
        </button>
        <button type="button" className="bk-ax-btn" aria-pressed={medium === "digital"} onClick={() => medium !== "digital" && onMedium(DIGITAL)}>
          デジタル
        </button>
      </fieldset>

      <PositionField current={index} total={total} count={1} onMove={onMoveTo} />

      {canCover && (
        <button type="button" className="bk-ax-btn bench-btn bench-btn--wide" disabled={isCover} onClick={onCover}>
          {isCover ? "この作品の表紙です" : "この作品の表紙にする"}
        </button>
      )}

      <label className="bench-field">
        <span>題（なくても構いません）</span>
        <input
          className="bench-input"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => void onSaveTitle(titleDraft.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>

      <WorkSelect works={works} activeKey={activeKey} onMoveWork={onMoveWork} />

      <div className="bench-panel__foot">
        <button type="button" className="bk-ax-btn bench-link" onClick={onOpenLibrary}>
          撮影情報・日付を詳しく直す（写真の一覧）
        </button>
        <button type="button" className="bk-ax-btn bench-link bench-link--danger" onClick={onTrash}>
          ゴミ箱へ
        </button>
      </div>
    </div>
  );
}

function MultiPanel({
  photos,
  total,
  works,
  activeKey,
  onClose,
  onPublish,
  onMoveTo,
  onMoveWork,
  onTrash,
}: {
  photos: Photo[];
  total: number;
  works: Work[];
  activeKey: WorkKey | null;
  onClose: () => void;
  onPublish: (v: boolean) => void;
  onMoveTo: (toIndex: number) => void;
  onMoveWork: (key: WorkKey) => void;
  onTrash: () => void;
}) {
  const published = photos.filter((p) => p.isPublished !== false).length;
  const [confirmTrash, setConfirmTrash] = useState(false);
  return (
    <div className="bench-panel">
      <div className="bench-panel__head">
        <p className="bench-panel__kicker">{photos.length}枚を選んでいます</p>
        <button type="button" className="bk-ax-btn bench-link" onClick={onClose}>
          選ぶのをやめる
        </button>
      </div>
      <div className="bench-multi__thumbs" aria-hidden="true">
        {photos.slice(0, 12).map((p) => (
          <img key={p.id} src={adminPhotoSrc(p, 200, 70)} alt="" loading="lazy" />
        ))}
        {photos.length > 12 && <span>＋{photos.length - 12}</span>}
      </div>
      <p className="bench-panel__facts">
        公開 {published} · 非公開 {photos.length - published}
      </p>
      <PublishSwitch
        published={published === photos.length}
        mixed={published !== 0 && published !== photos.length}
        onChange={onPublish}
      />
      <PositionField current={null} total={total} count={photos.length} onMove={onMoveTo} />
      <WorkSelect works={works} activeKey={activeKey} onMoveWork={onMoveWork} />
      <div className="bench-panel__foot">
        {confirmTrash ? (
          <span className="bench-row">
            <button type="button" className="bk-ax-btn bench-btn" onClick={() => setConfirmTrash(false)}>
              やめる
            </button>
            <button type="button" className="bk-ax-btn bench-btn bench-btn--danger" onClick={onTrash}>
              {photos.length}枚をゴミ箱へ
            </button>
          </span>
        ) : (
          <button type="button" className="bk-ax-btn bench-link bench-link--danger" onClick={() => setConfirmTrash(true)}>
            ゴミ箱へ
          </button>
        )}
      </div>
    </div>
  );
}

function WorkPanel({
  work,
  cover,
  onSave,
}: {
  work: Work;
  cover?: Photo;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const initial = {
    title: work.title ?? "",
    subtitle: work.subtitle ?? "",
    statement: work.statement ?? "",
    isPublished: work.isPublished !== false,
    kind: work.kind === "work" ? "work" : "series",
  };
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return (
    <form
      className="bench-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(draft);
        setSaving(false);
      }}
    >
      <p className="bench-panel__kicker">作品の設定</p>
      <div className="bench-panel__cover">
        {cover ? <img src={adminPhotoSrc(cover, 600, 78)} alt="" /> : <span aria-hidden="true" />}
        <p>表紙 — 写真を選んで「表紙にする」で変えられます</p>
      </div>
      <label className="bench-field">
        <span>題</span>
        <input className="bench-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="bench-field">
        <span>副題（なくても構いません）</span>
        <input className="bench-input" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
      </label>
      <label className="bench-field">
        <span>作家の言葉（作品の扉に出ます）</span>
        <textarea
          className="bench-input bench-input--area"
          rows={5}
          value={draft.statement}
          onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
        />
      </label>
      <fieldset className="bench-switch">
        <legend className="sr-only">作品をサイトに出すか</legend>
        <button type="button" className="bk-ax-btn" aria-pressed={draft.isPublished} onClick={() => setDraft({ ...draft, isPublished: true })}>
          公開
        </button>
        <button type="button" className="bk-ax-btn" aria-pressed={!draft.isPublished} onClick={() => setDraft({ ...draft, isPublished: false })}>
          非公開
        </button>
      </fieldset>
      <fieldset className="bench-switch">
        <legend className="sr-only">どちらの棚に置くか</legend>
        <button type="button" className="bk-ax-btn" aria-pressed={draft.kind === "series"} onClick={() => setDraft({ ...draft, kind: "series" })}>
          Series
        </button>
        <button type="button" className="bk-ax-btn" aria-pressed={draft.kind === "work"} onClick={() => setDraft({ ...draft, kind: "work" })}>
          Work
        </button>
      </fieldset>
      <p className="bench-panel__file">アドレス: /{draft.kind}/{work.slug}</p>
      {dirty && (
        <div className="bench-row">
          <button type="submit" className="bk-ax-btn bench-btn bench-btn--primary" disabled={saving}>
            {saving ? "保存しています…" : "変更を保存"}
          </button>
          <button type="button" className="bk-ax-btn bench-btn" onClick={() => setDraft(initial)}>
            やめる
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * 取り込んだあとの振り分けの確認。カメラの記録があればデジタル、無ければ
 * フィルムと自動で決めたので、違うものだけ押して直す。
 */
function ImportReview({
  items,
  photoById,
  onClose,
  onChange,
}: {
  items: Imported[];
  photoById: Map<number, Photo>;
  onClose: () => void;
  onChange: (changes: Imported[]) => Promise<void>;
}) {
  const [media, setMedia] = useState<Record<number, UploadMedium>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.medium])),
  );
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && typeof d.showModal === "function" && !d.open) d.showModal();
    d?.setAttribute("data-phase", "show");
  }, []);
  const changed = items.filter((i) => media[i.id] !== i.medium).map((i) => ({ ...i, medium: media[i.id]! }));
  const film = items.filter((i) => media[i.id] === "film").length;
  const setAll = (m: UploadMedium) => setMedia(Object.fromEntries(items.map((i) => [i.id, m])));
  return (
    <dialog ref={ref} className="bench-dialog bench-dialog--wide" onCancel={onClose} aria-labelledby="bench-review-title">
      <h2 id="bench-review-title" className="font-ja">
        {items.length}枚を加えました — フィルム {film} · デジタル {items.length - film}
      </h2>
      <p>
        カメラの記録があるものをデジタル、ないものをフィルムにしました。違うものは押して直してください。
        フィルムをデジタルカメラで複写した画像は、デジタルと判定されることがあります。
      </p>
      <div className="bench-row bench-row--end">
        <button type="button" className="bk-ax-btn bench-link" onClick={() => setAll("film")}>
          すべてフィルム
        </button>
        <button type="button" className="bk-ax-btn bench-link" onClick={() => setAll("digital")}>
          すべてデジタル
        </button>
      </div>
      <ul className="bench-review">
        {items.map((i) => {
          const p = photoById.get(i.id);
          const m = media[i.id]!;
          return (
            <li key={i.id}>
              <button
                type="button"
                className="bk-ax-btn bench-review__item"
                data-medium={m}
                onClick={() => setMedia({ ...media, [i.id]: m === "film" ? "digital" : "film" })}
                aria-label={`${i.name}: ${m === "film" ? "フィルム" : "デジタル"}（押すと切り替え）`}
              >
                {p && <img src={adminPhotoSrc(p, 200, 70)} alt="" />}
                <span>{m === "film" ? "フィルム" : "デジタル"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="bench-row bench-row--end">
        <button type="button" className="bk-ax-btn bench-btn" onClick={onClose}>
          このままでよい
        </button>
        <button
          type="button"
          className="bk-ax-btn bench-btn bench-btn--primary"
          disabled={changed.length === 0 || saving}
          onClick={async () => {
            setSaving(true);
            await onChange(changed);
          }}
        >
          {changed.length ? `${changed.length}枚を直す` : "直すものはありません"}
        </button>
      </div>
    </dialog>
  );
}
