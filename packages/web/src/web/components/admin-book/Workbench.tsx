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
import { moveItem, applyWorkOrder } from "../../lib/work-order";
import { uploadPhotoFile, type UploadMedium } from "../../lib/admin-upload";
import { isUploadableImageFile, imageFileTooLarge } from "../../lib/upload-file";
import "./admin-book.css";

type Work = AdminSeries & { kind?: string | null };
type WorkKey = number | "loose";

type UndoEntry = { label: string; run: () => Promise<void> };
type Notice = { text: string; undo?: UndoEntry; action?: { label: string; run: () => void } };

const MEDIUM_LABEL: Record<Medium, string> = {
  film: "フィルム",
  digital: "デジタル",
  unknown: "媒体の記録なし",
};

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

/**
 * 作品ごとの作業台（写真集の管理画面、2026-09-23 試作）。
 *
 * 左に作品、中央にその作品のベタ焼き（公開サイトの目次と同じ見た目）、
 * 右に選んでいるもの（写真 or 作品）の欄。**一番よく使う操作は
 * 「写真を加える」と「ドラッグで順番を変える」**なので、その2つだけを
 * 常に見せる。公開・表紙・移動・ゴミ箱は、写真を選んだときに右の欄に出る。
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
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
        ),
    [photosQ.data],
  );
  const works = useMemo(
    () =>
      [...(seriesQ.data?.series ?? [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      ),
    [seriesQ.data],
  );
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
    () =>
      allPhotos.filter((p) =>
        activeKey === "loose" ? p.seriesId == null : p.seriesId === activeKey,
      ),
    [allPhotos, activeKey],
  );
  const countOf = (key: WorkKey) =>
    allPhotos.filter((p) => (key === "loose" ? p.seriesId == null : p.seriesId === key)).length;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = workPhotos.find((p) => p.id === selectedId) ?? null;
  useEffect(() => setSelectedId(null), [activeKey]);

  // ── 通知と取り消し ─────────────────────────────────────
  const [notice, setNotice] = useState<Notice | null>(null);
  const undoStack = useRef<UndoEntry[]>([]);
  const noticeTimer = useRef<number | undefined>(undefined);
  const say = useCallback((n: Notice) => {
    setNotice(n);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), n.undo ? 9000 : 5000);
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
  const fail = useCallback(
    (text: string) => say({ text }),
    [say],
  );
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
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (undoStack.current.length === 0) return;
      e.preventDefault();
      void runUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runUndo]);

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
  const reorderWork = useCallback(
    async (from: number, to: number) => {
      const before = allPhotos.map((p) => p.id);
      const nextWork = moveItem(workPhotos.map((p) => p.id), from, to);
      const after = applyWorkOrder(before, nextWork);
      if (after.join() === before.join()) return;
      // 先に画面を動かし、保存は後ろで。失敗したら読み直す。
      qc.setQueryData<{ photos: Photo[] }>(["photos", "all"], (old) =>
        old
          ? {
              photos: old.photos.map((p) => {
                const i = after.indexOf(p.id);
                return i >= 0 ? { ...p, sortOrder: i } : p;
              }),
            }
          : old,
      );
      try {
        await saveOrder(after, before);
        remember(
          { label: "順番の変更", run: () => saveOrder(before, after) },
          `${pad2(from + 1)} を ${pad2(to + 1)} 番目へ動かしました`,
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
  const patchPhoto = useCallback(
    async (id: number, body: Partial<Photo>) => {
      const res = await adminApi.photos[":id"].$patch({ param: { id: String(id) }, json: body });
      assertOk(res);
    },
    [],
  );
  const patchWork = useCallback(async (id: number, body: Record<string, unknown>) => {
    const res = await adminApi.series[":id"].$patch({ param: { id: String(id) }, json: body });
    assertOk(res);
  }, []);

  const togglePublished = async (p: Photo) => {
    const was = p.isPublished !== false;
    try {
      await patchPhoto(p.id, { isPublished: !was });
      await refresh();
      remember(
        { label: was ? "非公開" : "公開", run: () => patchPhoto(p.id, { isPublished: was }) },
        was ? "非公開にしました（サイトに出ません）" : "公開しました",
      );
    } catch {
      fail("公開の設定を保存できませんでした。");
    }
  };
  const moveToWork = async (p: Photo, target: WorkKey) => {
    const from = p.seriesId ?? null;
    const to = target === "loose" ? null : target;
    if (from === to) return;
    try {
      await patchPhoto(p.id, { seriesId: to });
      await refresh();
      const name = target === "loose" ? "未整理" : (works.find((w) => w.id === target)?.title ?? "");
      remember(
        { label: "作品の移動", run: () => patchPhoto(p.id, { seriesId: from }) },
        `「${name}」へ移しました`,
      );
      setSelectedId(null);
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
  const trash = async (p: Photo) => {
    try {
      const res = await adminApi.photos[":id"].$delete({ param: { id: String(p.id) } });
      assertOk(res);
      await refresh();
      setSelectedId(null);
      remember(
        {
          label: "ゴミ箱への移動",
          run: async () => {
            const r = await adminApi.photos[":id"].restore.$post({ param: { id: String(p.id) } });
            assertOk(r);
          },
        },
        "ゴミ箱へ移しました（30日間は戻せます）",
      );
    } catch {
      fail("ゴミ箱へ移せませんでした。");
    }
  };

  // ── 取り込み ────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => onUploadingChange?.(uploading !== null), [uploading, onUploadingChange]);
  const defaultMedium: UploadMedium =
    workPhotos.filter((p) => mediumOf(p) === "film").length > workPhotos.length / 2
      ? "film"
      : "digital";
  const startImport = async (files: File[], medium: UploadMedium) => {
    setPendingFiles(null);
    const usable = files.filter((f) => isUploadableImageFile(f) && !imageFileTooLarge(f));
    const skipped = files.length - usable.length;
    if (usable.length === 0) {
      fail("取り込める画像がありませんでした（JPEG・PNG・HEIC など、容量の上限内の画像）。");
      return;
    }
    setUploading({ done: 0, total: usable.length });
    const added: number[] = [];
    let duplicates = 0;
    let failed = 0;
    const queue = [...usable];
    let done = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, queue.length) }, async () => {
        let f: File | undefined;
        while ((f = queue.shift())) {
          const r = await uploadPhotoFile(f, { medium, datePolicy: "exif" });
          if (r.kind === "added") {
            added.push(r.id);
            if (typeof activeKey === "number") {
              try {
                await patchPhoto(r.id, { seriesId: activeKey });
              } catch {
                /* 作品への割り当てに失敗しても写真は残る（未整理に出る） */
              }
            }
          } else if (r.kind === "duplicate") duplicates += 1;
          else failed += 1;
          done += 1;
          setUploading({ done, total: usable.length });
        }
      }),
    );
    setUploading(null);
    await refresh();
    onImported?.(added);
    const parts = [`${added.length}枚を加えました`];
    if (duplicates) parts.push(`${duplicates}枚は登録済みのため飛ばしました`);
    if (failed) parts.push(`${failed}枚は取り込めませんでした`);
    if (skipped) parts.push(`${skipped}件は画像ではないか大きすぎました`);
    say({
      text: parts.join(" · "),
      action: added.length
        ? { label: "撮影情報を確かめる", run: onOpenLibrary }
        : undefined,
    });
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
    if (files.length) setPendingFiles(files);
  };

  // ── コマのドラッグ ──────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
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
    allPhotos.find((p) => p.id === w.coverPhotoId) ??
    allPhotos.find((p) => p.seriesId === w.id);
  const title = activeKey === "loose" ? "未整理の写真" : (activeWork?.title ?? "");
  const publishedCount = workPhotos.filter((p) => p.isPublished !== false).length;

  return (
    <div className="bench" data-has-selection={selected ? "" : undefined}>
      {/* 作品 */}
      <nav className="bench-works" aria-label="作品">
        {shelves.map((shelf) =>
          shelf.items.length ? (
            <div key={shelf.key} className="bench-works__shelf">
              <p className="bench-works__shelf-label font-en">{shelf.label}</p>
              <ul>
                {shelf.items.map((w) => {
                  const cover = coverFor(w);
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        className="bk-ax-btn bench-work"
                        aria-current={activeKey === w.id ? "true" : undefined}
                        onClick={() => setStoredKey(w.id)}
                        onDragOver={(e) => {
                          if (dragIndex !== null) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const p = dragIndex !== null ? workPhotos[dragIndex] : undefined;
                          endDrag();
                          if (p) void moveToWork(p, w.id);
                        }}
                      >
                        <span className="bench-work__thumb" aria-hidden="true">
                          {cover && <img src={adminPhotoSrc(cover, 200, 70)} alt="" loading="lazy" />}
                        </span>
                        <span className="bench-work__name font-ja">{w.title || w.slug}</span>
                        <span className="bench-work__count font-en">{countOf(w.id)}</span>
                        {w.isPublished === false && (
                          <span className="bench-work__state">非公開</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
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
                onClick={() => setStoredKey("loose")}
                onDragOver={(e) => {
                  if (dragIndex !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const p = dragIndex !== null ? workPhotos[dragIndex] : undefined;
                  endDrag();
                  if (p) void moveToWork(p, "loose");
                }}
              >
                <span className="bench-work__thumb" aria-hidden="true" />
                <span className="bench-work__name font-ja">未整理</span>
                <span className="bench-work__count font-en">{countOf("loose")}</span>
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
                if (files.length) setPendingFiles(files);
              }}
            />
          </div>
        </header>

        <p className="bench-sheet__hint">
          {workPhotos.length > 1
            ? "コマをドラッグすると、サイトの順番が変わります。写真をここへ落とすと、この作品に加わります。"
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
          {mediumRuns(workPhotos).map((run) => (
            <div key={`${run.medium}-${run.start}`} className="bench-run" data-medium={run.medium}>
              <p className="bench-run__label">{MEDIUM_LABEL[run.medium]} {run.photos.length}</p>
              <ol className="bench-run__frames">
                {run.photos.map((p, i) => {
                  const index = run.start + i;
                  const dims = orientedDimensions(p.width, p.height, p.rotationDeg);
                  const ar = dims.width && dims.height ? dims.width / dims.height : 0.8;
                  const isCover = activeWork?.coverPhotoId === p.id;
                  return (
                    <li
                      key={p.id}
                      className="bench-frame"
                      data-selected={selectedId === p.id ? "" : undefined}
                      data-hidden={p.isPublished === false ? "" : undefined}
                      data-dragging={dragIndex === index ? "" : undefined}
                      data-drop={
                        overIndex === index && dragIndex !== null && dragIndex !== index
                          ? dragIndex < index
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
                          setDragIndex(index);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(p.id));
                        }}
                        onDragOver={(e) => {
                          if (dragIndex === null) return;
                          e.preventDefault();
                          setOverIndex(index);
                        }}
                        onDrop={(e) => {
                          if (dragIndex === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const from = dragIndex;
                          endDrag();
                          void reorderWork(from, index);
                        }}
                        onDragEnd={endDrag}
                        onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                        aria-pressed={selectedId === p.id}
                        aria-label={`${pad2(index + 1)}番目の写真${p.isPublished === false ? "（非公開）" : ""}${isCover ? "（表紙）" : ""}`}
                      >
                        <span
                          className="bench-frame__img"
                          style={{ "--ar": String(ar) } as React.CSSProperties}
                        >
                          <img src={adminPhotoSrc(p, 400, 72)} alt="" loading="lazy" draggable={false} />
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
      <aside className="bench-side" aria-label={selected ? "選んだ写真" : "作品の設定"}>
        {selected ? (
          <PhotoPanel
            photo={selected}
            index={workPhotos.findIndex((p) => p.id === selected.id)}
            total={workPhotos.length}
            works={works}
            activeKey={activeKey}
            isCover={activeWork?.coverPhotoId === selected.id}
            canCover={Boolean(activeWork)}
            onClose={() => setSelectedId(null)}
            onTogglePublished={() => void togglePublished(selected)}
            onMove={(delta) => {
              const i = workPhotos.findIndex((p) => p.id === selected.id);
              void reorderWork(i, Math.max(0, Math.min(workPhotos.length - 1, i + delta)));
            }}
            onMoveTo={(key) => void moveToWork(selected, key)}
            onCover={() => void setCover(selected)}
            onTrash={() => void trash(selected)}
            onSaveTitle={async (value) => {
              const before = selected.title ?? "";
              if (value === before) return;
              try {
                await patchPhoto(selected.id, { title: value });
                await refresh();
                remember(
                  { label: "題の変更", run: () => patchPhoto(selected.id, { title: before }) },
                  "題を保存しました",
                );
              } catch {
                fail("題を保存できませんでした。");
              }
            }}
            onOpenLibrary={onOpenLibrary}
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
                remember(
                  { label: "作品の設定", run: () => patchWork(activeWork.id, before) },
                  "作品の設定を保存しました",
                );
              } catch {
                fail("作品の設定を保存できませんでした。");
              }
            }}
          />
        ) : (
          <div className="bench-panel">
            <p className="bench-panel__lede font-ja">
              どの作品にも入っていない写真です。写真を選んで「別の作品へ移す」か、左の作品の上へドラッグしてください。
            </p>
          </div>
        )}
      </aside>

      {pendingFiles && (
        <ImportSheet
          files={pendingFiles}
          target={title}
          defaultMedium={defaultMedium}
          onCancel={() => setPendingFiles(null)}
          onStart={(medium) => void startImport(pendingFiles, medium)}
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

function PhotoPanel({
  photo,
  index,
  total,
  works,
  activeKey,
  isCover,
  canCover,
  onClose,
  onTogglePublished,
  onMove,
  onMoveTo,
  onCover,
  onTrash,
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
  onTogglePublished: () => void;
  onMove: (delta: number) => void;
  onMoveTo: (key: WorkKey) => void;
  onCover: () => void;
  onTrash: () => void;
  onSaveTitle: (value: string) => Promise<void>;
  onOpenLibrary: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(photo.title ?? "");
  useEffect(() => setTitleDraft(photo.title ?? ""), [photo.id, photo.title]);
  const published = photo.isPublished !== false;
  const facts = [
    MEDIUM_LABEL[mediumOf(photo)],
    photo.camera || null,
    shotLine(photo),
  ].filter(Boolean);
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
      <p className="bench-panel__facts">{facts.join(" · ")}</p>
      <p className="bench-panel__file">{photo.filename}</p>

      <fieldset className="bench-switch">
        <legend className="sr-only">サイトに出すか</legend>
        <button className="bk-ax-btn" type="button" aria-pressed={published} onClick={() => !published && onTogglePublished()}>
          公開
        </button>
        <button className="bk-ax-btn" type="button" aria-pressed={!published} onClick={() => published && onTogglePublished()}>
          非公開
        </button>
      </fieldset>

      <fieldset className="bench-row">
        <legend className="sr-only">この作品の中の順番</legend>
        <button type="button" className="bk-ax-btn bench-btn" disabled={index <= 0} onClick={() => onMove(-1)}>
          ← 前へ
        </button>
        <button type="button" className="bk-ax-btn bench-btn" disabled={index >= total - 1} onClick={() => onMove(1)}>
          後ろへ →
        </button>
      </fieldset>

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

      <label className="bench-field">
        <span>別の作品へ移す</span>
        <select
          className="bench-input"
          value={activeKey === null ? "" : String(activeKey)}
          onChange={(e) => onMoveTo(e.target.value === "loose" ? "loose" : Number(e.target.value))}
        >
          {works.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title || w.slug}
            </option>
          ))}
          <option value="loose">未整理</option>
        </select>
      </label>

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
        {cover ? (
          <img src={adminPhotoSrc(cover, 600, 78)} alt="" />
        ) : (
          <span aria-hidden="true" />
        )}
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
        <button className="bk-ax-btn" type="button" aria-pressed={draft.isPublished} onClick={() => setDraft({ ...draft, isPublished: true })}>
          公開
        </button>
        <button className="bk-ax-btn" type="button" aria-pressed={!draft.isPublished} onClick={() => setDraft({ ...draft, isPublished: false })}>
          非公開
        </button>
      </fieldset>
      <fieldset className="bench-switch">
        <legend className="sr-only">どちらの棚に置くか</legend>
        <button className="bk-ax-btn" type="button" aria-pressed={draft.kind === "series"} onClick={() => setDraft({ ...draft, kind: "series" })}>
          Series
        </button>
        <button className="bk-ax-btn" type="button" aria-pressed={draft.kind === "work"} onClick={() => setDraft({ ...draft, kind: "work" })}>
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

function ImportSheet({
  files,
  target,
  defaultMedium,
  onCancel,
  onStart,
}: {
  files: File[];
  target: string;
  defaultMedium: UploadMedium;
  onCancel: () => void;
  onStart: (medium: UploadMedium) => void;
}) {
  const [medium, setMedium] = useState<UploadMedium>(defaultMedium);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && typeof d.showModal === "function" && !d.open) d.showModal();
    // 管理画面の窓は data-phase="show" で見えるようになる（styles.css）。
    d?.setAttribute("data-phase", "show");
  }, []);
  return (
    <dialog ref={ref} className="bench-dialog" onCancel={onCancel} aria-labelledby="bench-import-title">
      <h2 id="bench-import-title" className="font-ja">
        {files.length}枚を「{target}」に加えます
      </h2>
      <p>どちらで撮った写真ですか。フィルムの写真は、撮影情報（カメラ・日付）をスキャンの情報として扱います。</p>
      <fieldset className="bench-switch">
        <legend className="sr-only">媒体</legend>
        <button className="bk-ax-btn" type="button" aria-pressed={medium === "film"} onClick={() => setMedium("film")}>
          フィルム
        </button>
        <button className="bk-ax-btn" type="button" aria-pressed={medium === "digital"} onClick={() => setMedium("digital")}>
          デジタル
        </button>
      </fieldset>
      <div className="bench-row bench-row--end">
        <button type="button" className="bk-ax-btn bench-btn" onClick={onCancel}>
          やめる
        </button>
        <button type="button" className="bk-ax-btn bench-btn bench-btn--primary" onClick={() => onStart(medium)}>
          加える
        </button>
      </div>
    </dialog>
  );
}
