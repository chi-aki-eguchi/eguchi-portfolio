import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { TILE_MAX, TILE_MIN, tileFromZoom, zoomForColumns, zoomFromTile } from "../../lib/page-photos";
import { measureFlip, playFlip, type Rects } from "./motion";

type Pending = { first: Rects; ms: number; from?: Rects; before?: () => void };

/**
 * 並べ直す直前に capture() を呼ぶと、描き直した後に、元の場所から新しい場所へ滑らせる。
 * before: 描き直した後・新しい場所を測る前にすること（つまんでいた見た目を外す、送りを合わせる）。
 */
export function useFlip(rootRef: RefObject<HTMLElement | null>) {
  const pending = useRef<Pending | null>(null);
  const capture = useCallback(
    (ms = 300, from?: Rects, before?: () => void) => {
      const root = rootRef.current;
      if (root) pending.current = { first: measureFlip(root), ms, from, before };
    },
    [rootRef],
  );
  // 描き直すたびに見る（頼まれていなければ何もしない）。
  useLayoutEffect(() => {
    const p = pending.current;
    const root = rootRef.current;
    if (!p || !root) return;
    pending.current = null;
    p.before?.();
    playFlip(root, p.first, p.ms, p.from);
  });
  return capture;
}

const PHONE = "(max-width: 767px)";
const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia(PHONE).matches;

/**
 * 写真の大きさ（つまみの値）。見る人ごとにこのブラウザへ覚える。
 * 最初の大きさは、スマホは「ちょうど3列」、PC は desktop の値。
 */
export function useStoredZoom(name: string, desktop: number, phoneGutter: number) {
  const key = `admin:pagePhotos:zoom:${name}`;
  const [zoom, setZoomState] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(key));
      if (window.localStorage.getItem(key) !== null && Number.isFinite(saved)) return Math.max(0, Math.min(100, saved));
    } catch {
      // 読めない環境では最初の大きさを使う。
    }
    return isPhone() ? zoomForColumns(window.innerWidth - phoneGutter, 3) : desktop;
  });
  const setZoom = useCallback(
    (value: number) => {
      const v = Math.max(0, Math.min(100, Math.round(value)));
      setZoomState(v);
      try {
        window.localStorage.setItem(key, String(v));
      } catch {
        // 覚えられなくても、この画面の間は効く。
      }
    },
    [key],
  );
  return [zoom, setZoom] as const;
}

/**
 * 2本の指でつまむと写真の大きさが変わる（スマホの写真アプリと同じ）。
 * つまんでいる間は並べ直さず、見た目だけを指に合わせて拡大・縮小する。指を離したときに
 * 1回だけ onCommit を呼ぶ（並べ直すのはそこ）。指が動くたびに並べ直すと、指の下の写真が
 * 1コマで大きく飛ぶ（試作で実測：1回のつまみで32回並べ直し、302px）。
 */
export function usePinchZoom(options: {
  /** 指を置く場所（ここで始まった2本指だけ見る）。 */
  areaRef: RefObject<HTMLElement | null>;
  /** 見た目を拡大・縮小する箱（写真の並び）。 */
  targetRef: RefObject<HTMLElement | null>;
  zoom: number;
  /** center: 2本の指のまん中（画面上の位置）。clear: 見た目だけ変えていた分を外す。 */
  onCommit: (zoom: number, center: { x: number; y: number }, clear: () => void) => void;
  onStart?: () => void;
}) {
  const live = useRef(options);
  live.current = options;
  useEffect(() => {
    const area = live.current.areaRef.current;
    if (!area) return;
    const points = new Map<number, [number, number]>();
    let active: { d0: number; tile: number; scale: number; center: { x: number; y: number }; target: HTMLElement } | null = null;
    const span = () => {
      const [a, b] = [...points.values()];
      return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 : 1;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      points.set(e.pointerId, [e.clientX, e.clientY]);
      const target = live.current.targetRef.current;
      if (points.size !== 2 || !target) return;
      const [a, b] = [...points.values()] as [[number, number], [number, number]];
      const center = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
      const r = target.getBoundingClientRect();
      target.style.transformOrigin = `${center.x - r.left}px ${center.y - r.top}px`;
      target.style.willChange = "transform";
      active = { d0: span(), tile: tileFromZoom(live.current.zoom), scale: 1, center, target };
      live.current.onStart?.();
    };
    const move = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, [e.clientX, e.clientY]);
      if (!active || points.size !== 2) return;
      active.scale = Math.max(TILE_MIN / active.tile, Math.min(TILE_MAX / active.tile, span() / active.d0));
      active.target.style.transform = `scale(${active.scale})`;
    };
    const up = (e: PointerEvent) => {
      if (!points.delete(e.pointerId) || !active || points.size >= 2) return;
      const { target, tile, scale, center } = active;
      active = null;
      const clear = () => {
        target.style.transform = "";
        target.style.transformOrigin = "";
        target.style.willChange = "";
      };
      live.current.onCommit(zoomFromTile(tile * scale), center, clear);
    };
    area.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      area.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);
}
