import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { orientedDimensions } from "../../../shared/image-url";
import { adminPhotoSrc } from "../../pages/admin-shared";
import { aspectOf, planRows } from "../../lib/photo-rows";
import { moveManyTo } from "../../lib/work-order";
import type { StudioPhoto } from "./studio-data";
import { adminText as tx } from "../../pages/admin-i18n";

export const DRAG_TYPE = "application/x-studio-photos";

/** 管理画面の一覧の大きさ（段の高さ px）。 */
export const GRID_SIZES = { s: 112, m: 164, l: 240 } as const;
export type GridSize = keyof typeof GRID_SIZES;

/**
 * 管理画面の写真の一覧。公開サイトと同じく、写真は元の縦横比のまま段に組む
 * （切り抜かない）。見えている段だけを描くので、写真が数千枚でも重くならない。
 *
 * - クリックで1枚、⌘（Ctrl）クリックで足す・外す、Shift クリックで範囲
 * - `pickMode` のときは、押すたびに足す・外す（指で使うとき）
 * - `canReorder` のときはドラッグで並べ替え。選んでいる写真をまとめて動かせる
 * - 左の列のシリーズへドラッグすると、そのシリーズに入る（DRAG_TYPE）
 * - ファイルを落とすと取り込む
 */
export function StudioGrid({
  photos,
  size,
  selected,
  onSelect,
  pickMode,
  canReorder,
  onReorder,
  onFiles,
  badges,
  scrollRef,
  empty,
  reveal,
}: {
  photos: StudioPhoto[];
  size: GridSize;
  selected: Set<number>;
  onSelect: (id: number, mode: "only" | "toggle" | "range") => void;
  pickMode: boolean;
  canReorder: boolean;
  onReorder: (moving: number[], toIndex: number) => void;
  onFiles?: (files: File[]) => void;
  /** 写真ごとの小さな印（「非公開」「表紙」「トップ」など） */
  badges: (p: StudioPhoto) => string[];
  scrollRef: React.RefObject<HTMLElement | null>;
  empty: React.ReactNode;
  /** この写真が見えていなければ、見える所まで送る（右の欄の「前・次」で移ったとき）。 */
  reveal?: number | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // 幅が変わったら組み直す。**同じコマの中で組み直す形（flushSync）は使わない。**
    // 試すと右の欄を開け閉めした最初の1コマの古い並びは消えるが、Safari では
    // 組み直しでスクロールバーが出入りして送り枠の幅がもう一度変わり、
    // 「ResizeObserver loop」のエラーになる（2026-10-05）。
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowHeight = GRID_SIZES[size];
  const plan = useMemo(() => {
    if (width <= 0) return null;
    const ratios = photos.map((p) => {
      const d = orientedDimensions(p.width, p.height, p.rotationDeg);
      return aspectOf(d.width, d.height);
    });
    return planRows(ratios, {
      width,
      gap: 6,
      targets: [rowHeight],
      maxHeight: rowHeight * 1.7,
      maxPerRow: 14,
    });
  }, [photos, width, rowHeight]);

  // 見えている範囲（前後に余裕を持って）だけを描く。
  const [view, setView] = useState({ top: 0, height: 1200 });
  useEffect(() => {
    const scroller = scrollRef.current;
    const box = boxRef.current;
    if (!scroller || !box) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const offset = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setView({ top: scroller.scrollTop - offset, height: scroller.clientHeight });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollRef, plan]);
  const margin = 900;
  const rows = plan
    ? plan.rows.filter((r) => r.top + r.height > view.top - margin && r.top < view.top + view.height + margin)
    : [];

  useEffect(() => {
    if (reveal == null || !plan) return;
    const index = photos.findIndex((p) => p.id === reveal);
    const row = plan.rows.find((r) => r.items.some((item) => item.index === index));
    const scroller = scrollRef.current,
      box = boxRef.current;
    if (!row || !scroller || !box) return;
    const offset = box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const top = offset + row.top;
    if (top < scroller.scrollTop || top + row.height > scroller.scrollTop + scroller.clientHeight)
      scroller.scrollTo({ top: Math.max(0, top - 24) });
    // 移ったときだけ送る（並びが変わるたびには送らない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // ── ドラッグ ──
  const [dragIds, setDragIds] = useState<number[] | null>(null);
  const [dropAt, setDropAt] = useState<{ id: number; after: boolean } | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const ids = useMemo(() => photos.map((p) => p.id), [photos]);

  const onDragStart = (e: React.DragEvent, id: number) => {
    const moving = selected.has(id) ? ids.filter((x) => selected.has(x)) : [id];
    setDragIds(moving);
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(moving));
    e.dataTransfer.setData("text/plain", tx(`${moving.length}枚の写真`, `${moving.length} photos`));
  };
  const endDrag = () => {
    setDragIds(null);
    setDropAt(null);
  };
  const onTileDragOver = (e: React.DragEvent, id: number) => {
    if (!dragIds || !canReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientX > r.left + r.width / 2;
    if (dropAt?.id !== id || dropAt.after !== after) setDropAt({ id, after });
  };
  const onTileDrop = (e: React.DragEvent, id: number) => {
    if (!dragIds || !canReorder) return;
    e.preventDefault();
    e.stopPropagation();
    const moving = dragIds;
    endDrag();
    if (moving.includes(id)) return;
    const rest = ids.filter((x) => !moving.includes(x));
    const at = rest.indexOf(id) + (dropAt?.after ? 1 : 0);
    const next = moveManyTo(ids, moving, at);
    if (next.join() !== ids.join()) onReorder(moving, at);
  };

  const onBoxDragOver = (e: React.DragEvent) => {
    if (!onFiles || !Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setFileOver(true);
  };
  const onBoxDrop = (e: React.DragEvent) => {
    setFileOver(false);
    if (!onFiles || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    onFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      ref={boxRef}
      className="st-grid"
      data-file-over={fileOver || undefined}
      onDragOver={onBoxDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setFileOver(false);
      }}
      onDrop={onBoxDrop}
      style={{ height: plan ? Math.max(plan.height, 1) : undefined }}
    >
      {photos.length === 0 && <div className="st-grid__empty">{empty}</div>}
      {/* 段ごとの入れ子にしない（flatMap）。入れ子だと key は段の中でしか効かず、
          大きさ・幅・絞り込みが変わって写真が別の段へ移るたびに、タイルごと作り直される。
          作り直された <img> は手元にある画像でも次のコマまで空で、大きさを変えたときは
          新しい大きさの画像が届くまで空のままだった（2026-10-05 実測: 大きさ「大」で
          画面の 16/96 マスが1コマ空。本番の回線ではその間ずっと）。1本の並びなら、
          写真は同じ要素のまま位置だけ動き、前の画像を出したまま新しい画像に替わる。 */}
      {rows.flatMap((row) =>
        row.items.map((item) => {
          const p = photos[item.index]!;
          const isSelected = selected.has(p.id);
          const marks = badges(p);
          const drop = dropAt?.id === p.id ? (dropAt.after ? "after" : "before") : undefined;
          return (
            <button
              key={p.id}
              type="button"
              className="st-ax-btn st-tile"
              data-selected={isSelected || undefined}
              data-hidden={p.isPublished === false || undefined}
              data-dragging={dragIds?.includes(p.id) || undefined}
              data-drop={drop}
              data-photo-id={p.id}
              aria-pressed={isSelected}
              aria-label={`${p.title || p.filename}${p.isPublished === false ? tx("（非公開）", " (hidden)") : ""}`}
              style={{ left: item.x, top: row.top, width: item.width, height: row.height }}
              draggable
              onDragStart={(e) => onDragStart(e, p.id)}
              onDragEnd={endDrag}
              onDragOver={(e) => onTileDragOver(e, p.id)}
              onDrop={(e) => onTileDrop(e, p.id)}
              onClick={(e) =>
                onSelect(
                  p.id,
                  e.shiftKey ? "range" : e.metaKey || e.ctrlKey || pickMode ? "toggle" : "only",
                )
              }
            >
              <img
                src={adminPhotoSrc(p, size === "l" ? 900 : 480, 70)}
                alt=""
                // 描くのは見えている段の前後だけ（上の `rows`）なので、すぐ読む。
                // lazy・async だと、手元にある画像でも現れた最初のコマが空になる。
                loading="eager"
                decoding="sync"
                draggable={false}
                className="st-tile__img"
              />
              {marks.length > 0 && (
                <span className="st-tile__marks">
                  {marks.map((m) => (
                    <span key={m} className="st-tile__mark">
                      {m}
                    </span>
                  ))}
                </span>
              )}
              {pickMode && <span className="st-tile__check" aria-hidden="true" />}
            </button>
          );
        }),
      )}
    </div>
  );
}
