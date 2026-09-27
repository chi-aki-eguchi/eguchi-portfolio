import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, adminApi } from "../../lib/api";
import { assertOk, jsonOrThrow, type AdminSeries, type Photo } from "../../pages/admin-shared";
import { uploadPhotoFile } from "../../lib/admin-upload";
import { isUploadableImageFile, imageFileTooLarge } from "../../lib/upload-file";

/**
 * 管理画面（写真中心、2026-09-26 作り直し）のデータと操作。
 *
 * 写真が主役。シリーズは写真に付ける「入れ物」で、1枚を何本にも入れられる
 * （`series_photos`）。どの操作も直後に「元に戻す」が出て、⌘Z でも戻せる。
 */

export type StudioPhoto = Photo & { seriesIds?: number[] };
export type StudioSeries = AdminSeries & { kind?: string | null; themeConfig?: string | null };
type Membership = { seriesId: number; photoId: number; sortOrder: number };
type HeroRow = { id: number; photoId: number; sortOrder: number };
type Category = { id: number; slug: string; label: string };

const byOrder = (a: { sortOrder?: number | null; id: number }, b: { sortOrder?: number | null; id: number }) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id;

export function useStudioData() {
  const photosQ = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow<{ photos: StudioPhoto[] }>(await api.photos.$get({ query: { all: "1" } })),
  });
  const seriesQ = useQuery({
    queryKey: ["admin-series"],
    queryFn: async () => jsonOrThrow<{ series: StudioSeries[] }>(await adminApi.series.$get()),
  });
  const membersQ = useQuery({
    queryKey: ["admin-series-photos"],
    queryFn: async () =>
      jsonOrThrow<{ memberships: Membership[] }>(await adminApi["series-photos"].$get()),
  });
  const heroQ = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: async () => jsonOrThrow<{ heroPhotos: HeroRow[] }>(await adminApi["hero-photos"].$get()),
  });
  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow<{ categories: Category[] }>(await api.categories.$get()),
    staleTime: 5 * 60_000,
  });

  const photos = useMemo(
    () => [...(photosQ.data?.photos ?? [])].filter((p) => !p.deletedAt).sort(byOrder),
    [photosQ.data],
  );
  const photoById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const series = useMemo(() => [...(seriesQ.data?.series ?? [])].sort(byOrder), [seriesQ.data]);
  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);

  /**
   * シリーズごとの結びつき（シリーズの中の並び順）。ゴミ箱の写真も含む。
   * 並べ替えの保存はシリーズの写真**全部**を送るので、こちらを使う。
   */
  const allMembersBySeries = useMemo(() => {
    const map = new Map<number, number[]>();
    const rows = [...(membersQ.data?.memberships ?? [])].sort(
      (a, b) => a.seriesId - b.seriesId || a.sortOrder - b.sortOrder || a.photoId - b.photoId,
    );
    for (const m of rows) {
      const list = map.get(m.seriesId);
      if (list) list.push(m.photoId);
      else map.set(m.seriesId, [m.photoId]);
    }
    return map;
  }, [membersQ.data]);
  /** シリーズごとの写真（画面に出すもの。ゴミ箱の写真は除く）。 */
  const membersBySeries = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const [sid, ids] of allMembersBySeries) map.set(sid, ids.filter((id) => photoById.has(id)));
    return map;
  }, [allMembersBySeries, photoById]);

  /** 写真ごとの所属（シリーズの並び順）。 */
  const seriesOfPhoto = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const s of series)
      for (const id of membersBySeries.get(s.id) ?? []) {
        const list = map.get(id);
        if (list) list.push(s.id);
        else map.set(id, [s.id]);
      }
    return map;
  }, [series, membersBySeries]);

  const heroIds = useMemo(() => (heroQ.data?.heroPhotos ?? []).map((h) => h.photoId), [heroQ.data]);
  const heroSet = useMemo(() => new Set(heroIds), [heroIds]);

  return {
    loading: photosQ.isLoading || seriesQ.isLoading || membersQ.isLoading,
    failed: photosQ.isError || seriesQ.isError || membersQ.isError,
    retry: () => {
      void photosQ.refetch();
      void seriesQ.refetch();
      void membersQ.refetch();
    },
    photos,
    photoById,
    series,
    seriesById,
    membersBySeries,
    allMembersBySeries,
    seriesOfPhoto,
    heroIds,
    heroSet,
    categories: catsQ.data?.categories ?? [],
  };
}

export type StudioData = ReturnType<typeof useStudioData>;

// ── 通知・元に戻す・取り込み（写真とシリーズの画面で共有） ─────────────

type UndoEntry = { label: string; run: () => Promise<void> };
export type StudioNotice = { text: string; undo?: UndoEntry; tone?: "error" };
export type UploadState = { done: number; total: number; target: number | null } | null;

type StudioCtx = {
  notice: StudioNotice | null;
  say: (n: StudioNotice) => void;
  dismiss: () => void;
  /** 操作が済んだあとに呼ぶ。通知に「元に戻す」を出し、⌘Z の対象にする。 */
  remember: (entry: UndoEntry, text: string) => void;
  undo: (entry?: UndoEntry) => Promise<void>;
  fail: (text: string) => void;
  refresh: () => Promise<void>;
  upload: UploadState;
  /** 取り込む。`target` のシリーズがあれば、取り込んだ写真をそこへ入れる。 */
  importFiles: (files: File[], target: number | null) => Promise<number[]>;
  recentIds: number[];
};

const Ctx = createContext<StudioCtx | null>(null);

export function useStudio(): StudioCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("StudioProvider is missing");
  return v;
}

export function StudioProvider({
  children,
  onUploadingChange,
}: {
  children: React.ReactNode;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<StudioNotice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const stack = useRef<UndoEntry[]>([]);
  const say = useCallback((n: StudioNotice) => {
    setNotice(n);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), n.undo ? 10000 : n.tone === "error" ? 8000 : 4500);
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);
  const refresh = useCallback(async () => {
    await Promise.all(
      [
        ["photos"],
        ["admin-series"],
        ["admin-series-photos"],
        ["admin-hero-photos"],
        ["series"],
        ["works"],
        ["hero-photos"],
        ["photo-availability"],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
  }, [qc]);
  const fail = useCallback((text: string) => say({ text, tone: "error" }), [say]);
  const remember = useCallback(
    (entry: UndoEntry, text: string) => {
      stack.current.push(entry);
      if (stack.current.length > 40) stack.current.shift();
      say({ text, undo: entry });
    },
    [say],
  );
  const undo = useCallback(
    async (entry?: UndoEntry) => {
      const target = entry ?? stack.current.pop();
      if (!target) return;
      stack.current = stack.current.filter((e) => e !== target);
      try {
        await target.run();
        await refresh();
        say({ text: `元に戻しました（${target.label}）` });
      } catch {
        await refresh();
        fail("元に戻せませんでした。最新の状態を読み直しました。");
      }
    },
    [fail, refresh, say],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (stack.current.length === 0) return;
      e.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const [upload, setUpload] = useState<UploadState>(null);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  useEffect(() => onUploadingChange?.(upload !== null), [upload, onUploadingChange]);
  // 取り込み中にページを閉じようとしたら止める（途中の写真が宙に浮く）。
  useEffect(() => {
    if (!upload) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [upload]);

  const importFiles = useCallback(
    async (files: File[], target: number | null) => {
      const usable = files.filter((f) => isUploadableImageFile(f) && !imageFileTooLarge(f));
      const skipped = files.length - usable.length;
      if (usable.length === 0) {
        fail("取り込める画像がありませんでした（JPEG・PNG・HEIC など、容量の上限内の画像）。");
        return [];
      }
      setUpload({ done: 0, total: usable.length, target });
      const added: number[] = [];
      let duplicates = 0;
      let failed = 0;
      let done = 0;
      const queue = [...usable];
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          let f: File | undefined;
          while ((f = queue.shift())) {
            // 媒体はカメラの記録から自動で決める。違っていたら右の欄で直す。
            const r = await uploadPhotoFile(f, { medium: "auto", datePolicy: "exif" });
            if (r.kind === "added") added.push(r.id);
            else if (r.kind === "duplicate") duplicates += 1;
            else failed += 1;
            done += 1;
            setUpload({ done, total: usable.length, target });
          }
        }),
      );
      if (target != null && added.length) {
        try {
          const res = await adminApi.series[":id"].photos.$post({
            param: { id: String(target) },
            json: { add: added },
          });
          assertOk(res);
        } catch {
          /* シリーズへの割り当てに失敗しても写真は残る（どこにも入っていない写真に出る） */
        }
      }
      setUpload(null);
      setRecentIds(added);
      await refresh();
      const parts = [`${added.length}枚を加えました`];
      if (duplicates) parts.push(`${duplicates}枚は登録済みのため飛ばしました`);
      if (failed) parts.push(`${failed}枚は取り込めませんでした`);
      if (skipped) parts.push(`${skipped}件は画像ではないか大きすぎました`);
      say({ text: parts.join(" · "), tone: failed ? "error" : undefined });
      return added;
    },
    [fail, refresh, say],
  );

  const value = useMemo(
    () => ({ notice, say, dismiss, remember, undo, fail, refresh, upload, importFiles, recentIds }),
    [notice, say, dismiss, remember, undo, fail, refresh, upload, importFiles, recentIds],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── 書き込み（どれも応答を確かめてから次へ進む） ─────────────────────

export async function batch(ids: number[], operation: string, value?: unknown) {
  if (ids.length === 0) return;
  const res = await adminApi.photos.batch.$post({ json: { ids, operation, value } });
  assertOk(res);
}

export async function patchPhoto(id: number, body: Record<string, unknown>) {
  const res = await adminApi.photos[":id"].$patch({ param: { id: String(id) }, json: body });
  assertOk(res);
}

export async function seriesPhotos(seriesId: number, body: { add?: number[]; remove?: number[] }) {
  const res = await adminApi.series[":id"].photos.$post({ param: { id: String(seriesId) }, json: body });
  assertOk(res);
}

export async function reorderSeriesPhotos(seriesId: number, ids: number[]) {
  const res = await adminApi.series[":id"].photos.reorder.$post({
    param: { id: String(seriesId) },
    json: { ids },
  });
  if (res.status === 409) throw new Error("conflict");
  assertOk(res);
}

export async function reorderAllPhotos(ids: number[], expectedIds: number[]) {
  const res = await adminApi.photos.reorder.$post({ json: { ids, expectedIds } });
  if (res.status === 409) throw new Error("conflict");
  assertOk(res);
}

export async function patchSeries(id: number, body: Record<string, unknown>) {
  const res = await adminApi.series[":id"].$patch({ param: { id: String(id) }, json: body });
  assertOk(res);
}

export async function createSeries(body: { title: string; slug: string; kind: string; isPublished?: boolean }) {
  const res = await adminApi.series.$post({ json: body });
  return jsonOrThrow<{ series: StudioSeries }>(res);
}

export async function deleteSeries(id: number) {
  const res = await adminApi.series[":id"].$delete({ param: { id: String(id) } });
  assertOk(res);
}

export async function reorderSeriesList(ids: number[], expectedIds: number[]) {
  const res = await adminApi.series.reorder.$post({ json: { ids, expectedIds } });
  if (res.status === 409) throw new Error("conflict");
  assertOk(res);
}

export async function trashPhoto(id: number) {
  const res = await adminApi.photos[":id"].$delete({ param: { id: String(id) } });
  assertOk(res);
}

export async function restorePhoto(id: number) {
  const res = await adminApi.photos[":id"].restore.$post({ param: { id: String(id) } });
  assertOk(res);
}

/** 題名から URL の一部を作る（英数字だけ。無ければ日付から）。 */
export function slugFromTitle(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `series-${Date.now().toString(36)}`;
}

export function shotLine(p: Photo): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.shotAt ?? "");
  if (!m) return null;
  const date = `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
  return p.filmType === "フィルム" ? `${date}にスキャン` : `${date}に撮影`;
}

/** 検索語に当たるか（ファイル名・題・カメラ・レンズ・日付「2025-10」「2025年10月」）。 */
export function matchesQuery(p: Photo, q: string): boolean {
  if (!q.trim()) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.shotAt ?? "");
  const hay = [
    p.filename,
    p.title,
    p.description,
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
