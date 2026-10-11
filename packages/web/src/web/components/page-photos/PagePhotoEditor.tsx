import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { adminPhotoObjectPosition, adminPhotoSrc } from "../../pages/admin-shared";
import {
  dropAt,
  gapForTile,
  moveGroup,
  sameOrder,
  tileFromZoom,
  type MoveHow,
  type PagePhoto,
} from "../../lib/page-photos";
import { measureFlip, playFlip, type Rects } from "./motion";
import { useFlip, usePinchZoom, useStoredZoom } from "./hooks";
import { PhotoPicker } from "./PhotoPicker";
import { ZoomSlider } from "./ZoomSlider";
import "./page-photos.css";

type Drag = {
  id: number;
  pointer: number;
  touch: boolean;
  x0: number;
  y0: number;
  x: number;
  y: number;
  timer: number;
  active: boolean;
  ids: number[];
  size: number;
  at: number | null;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
};

/** 指は、止めたままこの時間だけ待つと「つかんだ」になる（すぐ動かしたら、いつもの送り）。 */
const HOLD_MS = 320;

/**
 * 1つのページに出す写真を、選んで並べる。
 *
 * - つまみ（スマホは2本の指でつまんでも）で写真の大きさを変え、全体を見渡す
 * - つかんで動かす（マウスはそのまま、指は長押ししてから）。行き先に線が出る
 * - 押すと選べて、下の帯からまとめて 前へ／後ろへ／先頭へ／最後へ／外す
 * - 番号は出さない
 *
 * 並びを変えるたびに onChange を呼ぶ（保存は呼ぶ側）。写真は作り直さず、新しい場所へ滑らせる。
 */
export function PagePhotoEditor({
  photos,
  value,
  used,
  series,
  name,
  onChange,
}: {
  /** 公開している写真すべて（足す画面の候補）。 */
  photos: PagePhoto[];
  /** このページに出す写真（この並びのまま出る）。 */
  value: number[];
  /** どこかのページに出している写真（足す画面の「まだ出していない」に使う）。 */
  used: ReadonlySet<number>;
  series: { id: number; title: string }[];
  /** ページの名前（Portrait など）。 */
  name: string;
  onChange: (next: number[], message: string) => void;
}) {
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const list = useMemo(
    () => value.map((id) => byId.get(id)).filter((p): p is PagePhoto => Boolean(p)),
    [value, byId],
  );
  const order = useMemo(() => list.map((p) => p.id), [list]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  // スマホでは写真を画面の端から端まで並べる（左右の余白 0）。最初はちょうど3列。
  const [zoom, setZoom] = useStoredZoom("page", 75, 0);
  const [picking, setPicking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const capture = useFlip(gridRef);
  const suppressClick = useRef(0);

  // 外した写真は、選択からも外す。
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => order.includes(id)));
      return next.size === s.size ? s : next;
    });
  }, [order]);

  const apply = useCallback(
    (next: number[], message: string, from?: Rects) => {
      if (sameOrder(next, order)) return;
      capture(320, from);
      onChange(next, message);
    },
    [capture, onChange, order],
  );

  const live = useRef({ order, selected, apply });
  live.current = { order, selected, apply };
  const drag = useRef<Drag | null>(null);

  // ── つかんで動かす ──────────────────────────────────────
  const end = useCallback((d: Drag, commit: boolean) => {
    window.clearTimeout(d.timer);
    if (drag.current === d) drag.current = null;
    if (!d.active) return;
    const dropped = d.ghost?.getBoundingClientRect();
    d.ghost?.remove();
    d.line?.remove();
    document.body.classList.remove("pp-dragging");
    gridRef.current?.querySelectorAll(".pp-tile[data-moving]").forEach((t) => t.removeAttribute("data-moving"));
    suppressClick.current = performance.now();
    if (!commit || d.at === null) return;
    const next = dropAt(live.current.order, d.ids, d.at);
    // つかんだ写真は、離した場所から行き先へ滑る。
    live.current.apply(
      next,
      d.ids.length > 1 ? `${d.ids.length} 枚を動かしました` : "並べ替えました",
      dropped ? new Map([[String(d.id), dropped]]) : undefined,
    );
  }, []);

  const track = useCallback((d: Drag, x: number, y: number) => {
    const grid = gridRef.current;
    if (!grid || !d.ghost || !d.line) return;
    d.x = x;
    d.y = y;
    // 指で隠れないよう、指のときは少し上に出す。
    d.ghost.style.transform = `translate(${x - d.size / 2}px,${y - d.size * (d.touch ? 1.1 : 0.5)}px) rotate(-2deg)`;
    // 行き先：いちばん近い写真の、左半分なら手前・右半分なら後ろ。
    let best: { index: number; rect: DOMRect; after: boolean } | null = null;
    let distance = Infinity;
    grid.querySelectorAll<HTMLElement>(".pp-tile").forEach((tile, index) => {
      const r = tile.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = (Math.abs(y - cy) / r.height) * 3 + Math.abs(x - cx) / r.width;
      if (dist < distance) {
        distance = dist;
        best = { index, rect: r, after: x > cx };
      }
    });
    if (!best) return;
    const { index, rect, after } = best as { index: number; rect: DOMRect; after: boolean };
    d.at = index + (after ? 1 : 0);
    const box = grid.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    d.line.style.left = `${(after ? rect.right + gap / 2 : rect.left - gap / 2) - box.left - 1.5}px`;
    d.line.style.top = `${rect.top - box.top}px`;
    d.line.style.height = `${rect.height}px`;
  }, []);

  const start = useCallback(
    (d: Drag) => {
      const grid = gridRef.current;
      const tile = grid?.querySelector<HTMLElement>(`.pp-tile[data-photo="${d.id}"]`);
      if (!grid || !tile) return;
      const { order: current, selected: chosen } = live.current;
      d.active = true;
      d.ids = chosen.has(d.id) ? current.filter((id) => chosen.has(id)) : [d.id];
      d.size = Math.max(64, Math.min(tile.getBoundingClientRect().width, 150));
      const ghost = document.createElement("div");
      ghost.className = "pp-ghost";
      ghost.style.width = ghost.style.height = `${d.size}px`;
      const img = document.createElement("img");
      img.src = tile.querySelector("img")?.currentSrc || tile.querySelector("img")?.src || "";
      img.alt = "";
      ghost.appendChild(img);
      if (d.ids.length > 1) {
        const badge = document.createElement("b");
        badge.textContent = String(d.ids.length);
        ghost.appendChild(badge);
      }
      document.body.appendChild(ghost);
      const line = document.createElement("div");
      line.className = "pp-dropline";
      grid.appendChild(line);
      d.ghost = ghost;
      d.line = line;
      for (const id of d.ids) grid.querySelector(`.pp-tile[data-photo="${id}"]`)?.setAttribute("data-moving", "");
      document.body.classList.add("pp-dragging");
      // 画面の端に近づけたら、その向きへ送る（上は、上に貼り付いた帯の下から）。
      const edge = () => {
        if (drag.current !== d) return;
        const margin = 90;
        const top = (document.querySelector<HTMLElement>("[data-pp-sticky]")?.getBoundingClientRect().bottom ?? 0) + margin;
        const speed = d.y < top ? -(top - d.y) / 5 : d.y > window.innerHeight - margin ? (d.y - (window.innerHeight - margin)) / 5 : 0;
        if (speed) {
          window.scrollBy(0, speed);
          track(d, d.x, d.y);
        }
        requestAnimationFrame(edge);
      };
      requestAnimationFrame(edge);
      track(d, d.x, d.y);
    },
    [track],
  );

  const onTileDown = (e: React.PointerEvent, id: number) => {
    if (e.button > 0) return;
    const d: Drag = {
      id,
      pointer: e.pointerId,
      touch: e.pointerType !== "mouse",
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      timer: 0,
      active: false,
      ids: [],
      size: 0,
      at: null,
      ghost: null,
      line: null,
    };
    drag.current = d;
    if (d.touch) d.timer = window.setTimeout(() => drag.current === d && start(d), HOLD_MS);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointer) return;
      if (d.active) return track(d, e.clientX, e.clientY);
      d.x = e.clientX;
      d.y = e.clientY;
      const far = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      if (d.touch) {
        if (far > 10) end(d, false);
      } else if (far > 6) start(d);
    };
    const stop = (e: PointerEvent) => {
      const d = drag.current;
      if (d && e.pointerId === d.pointer) end(d, e.type === "pointerup");
    };
    // つかんでいる間は、頁を送らせない（受け身でない聞き方でないと止められない）。
    const hold = (e: TouchEvent) => {
      if (drag.current?.active) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current?.active) end(drag.current, false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    document.addEventListener("touchmove", hold, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.removeEventListener("touchmove", hold);
      window.removeEventListener("keydown", key);
      if (drag.current) end(drag.current, false);
    };
  }, [end, start, track]);

  // ── 2本の指でつまんで、大きさを変える ─────────────────────────
  usePinchZoom({
    areaRef: gridRef,
    targetRef: gridRef,
    zoom,
    onStart: () => {
      if (drag.current) end(drag.current, false);
    },
    onCommit: (next, center, clear) => {
      suppressClick.current = performance.now();
      const grid = gridRef.current;
      if (!grid) return clear();
      const under = document.elementFromPoint(center.x, center.y)?.closest<HTMLElement>(".pp-tile");
      // 指の下の写真を、指の下に保ったまま並べ直す。
      const settle = () => {
        clear();
        if (under?.isConnected) {
          const r = under.getBoundingClientRect();
          window.scrollBy(0, r.top + r.height / 2 - center.y);
        }
      };
      if (next === zoom) {
        const first = measureFlip(grid);
        settle();
        playFlip(grid, first, 280);
        return;
      }
      capture(280, undefined, settle);
      setZoom(next);
    },
  });

  const toggle = (id: number) => {
    if (performance.now() - suppressClick.current < 350) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const moveSelected = (how: MoveHow) => apply(moveGroup(order, [...selected], how), "並べ替えました");
  const removeSelected = () => {
    apply(
      order.filter((id) => !selected.has(id)),
      "このページから外しました",
    );
    setSelected(new Set());
  };

  const tile = tileFromZoom(zoom);
  const vars = { "--pp-tile": `${tile}px`, "--pp-gap": `${gapForTile(tile)}px` } as CSSProperties;

  return (
    <div className="pp-editor">
      <div className="pp-tools">
        <span className="pp-tools__count">
          {list.length} 枚<small>　この並びのまま、サイトに出ます</small>
        </span>
        <ZoomSlider
          value={zoom}
          onChange={(v) => {
            capture(160);
            setZoom(v);
          }}
        />
      </div>
      <div className="pp-grid" ref={gridRef} style={vars} data-pp-grid>
        {list.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="pp-tile"
            data-flip={photo.id}
            data-photo={photo.id}
            aria-pressed={selected.has(photo.id)}
            aria-label={`${index + 1}枚目の写真`}
            onPointerDown={(e) => onTileDown(e, photo.id)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => toggle(photo.id)}
          >
            <img
              src={adminPhotoSrc(photo, 480, 80)}
              alt=""
              decoding="async"
              draggable={false}
              style={{ objectPosition: adminPhotoObjectPosition(photo) }}
            />
            <span className="pp-check" aria-hidden="true">
              ✓
            </span>
          </button>
        ))}
        <button type="button" className="pp-add" data-flip="add" aria-label="写真を足す" onClick={() => setPicking(true)}>
          ＋
        </button>
      </div>
      {/* 使い方は畳んでおく（毎回は読まない。開いたままだと、写真の下に長い文が居座る）。 */}
      <details className="pp-help">
        <summary>使い方</summary>
        <p>
          写真をつかんで動かすと、並べ替えられます（スマホは長押ししてから動かす）。押すと選べて、何枚かまとめて動かしたり外したりできます。
          右上のつまみ（スマホは2本の指でつまんでも）で写真を小さくすると、全体を見渡せます。「外す」はこのページから外すだけで、写真そのものは消えません。
        </p>
      </details>

      <div className="pp-selbar" data-show={selected.size > 0 || undefined} role="toolbar" aria-label="選んだ写真">
        <div className="pp-selbar__in">
          <span>{selected.size} 枚を選択中</span>
          <button type="button" onClick={() => moveSelected("prev")} aria-label="1つ前へ" title="1つ前へ">
            ←
          </button>
          <button type="button" onClick={() => moveSelected("next")} aria-label="1つ後ろへ" title="1つ後ろへ">
            →
          </button>
          <button type="button" onClick={() => moveSelected("first")}>
            先頭へ
          </button>
          <button type="button" onClick={() => moveSelected("last")}>
            最後へ
          </button>
          <button type="button" onClick={removeSelected}>
            外す
          </button>
          <button type="button" onClick={() => setSelected(new Set())} aria-label="選択をやめる" title="選択をやめる">
            ✕
          </button>
        </div>
      </div>

      {picking && (
        <PhotoPicker
          photos={photos}
          value={order}
          used={used}
          series={series}
          name={name}
          onClose={() => setPicking(false)}
          onDone={(next) => {
            setPicking(false);
            setSelected(new Set());
            apply(next, "写真を入れ替えました");
          }}
        />
      )}
    </div>
  );
}
