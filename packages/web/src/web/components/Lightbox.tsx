import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// R2: the fitted (non-zoomed) photo claims ~95% of the viewport. The srcset lets
// the browser pick by viewport × devicePixelRatio — phones get ~1200px, Retina
// desktops climb to 2400px — so it's sharp everywhere without over-downloading.
const FIT_W = "95vw";
const FIT_H = "94dvh";
// Exported so grids can warm the exact candidate the lightbox will request
// (a prefetch with a different w= is a wasted download, not a cache hit).
export const FIT_SIZES = "95vw";
export const fitSrcSet = (url: string) =>
  `${url}?w=1200&q=88 1200w, ${url}?w=1600&q=88 1600w, ${url}?w=2000&q=90 2000w, ${url}?w=2400&q=90 2400w`;

export type LightboxPhoto = {
  url: string;
  title: string;
  meta?: string;
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
};

/**
 * Full-screen photo viewer rendered via portal. Shared by the homepage "Works"
 * grid and the gallery / series grids so both behave identically.
 *
 * The photo is the star: it fills the viewport with the counter / caption / nav
 * overlaid (not stealing image space). Tap/click the photo to hide all chrome
 * ("photo only" immersive mode); tap again to bring it back. A dedicated button
 * zooms to the full-resolution render for detail; swipe / arrows navigate.
 *
 * Built on the native <dialog>: showModal gives focus trapping, an inert
 * background and focus restoration for free. Backdrop click + swipe are wired via
 * addEventListener (not JSX props) because <dialog> is treated as non-interactive.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [chrome, setChrome] = useState(true); // counter / caption / nav visibility
  const [hiRes, setHiRes] = useState(false);  // has the full-size image arrived? (blur-up)
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fitImgRef = useRef<HTMLImageElement>(null);   // hi-res fitted image
  const placeImgRef = useRef<HTMLImageElement>(null); // blur-up placeholder (defines the box)

  // ── Zoom / pan engine ────────────────────────────────────
  // scale/tx/ty live in refs and are written straight to the layer's style:
  // wheel ticks and pinch frames must not re-render React. `isZoomed` mirrors
  // the >1 threshold for the bits of UI that do depend on it (chrome, sources).
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomSrcReady, setZoomSrcReady] = useState(false); // 3200px overlay loaded
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  // Deps-frozen touch/click handlers read these refs for the latest gesture state.
  const zoomedRef = useRef(false);
  const suppressClickRef = useRef(false); // a pan/pinch just ended — swallow the click
  const MAX_SCALE = 4;

  // The photo's on-screen size at scale 1 (object-fit: contain inside the FIT box).
  const photoBaseDims = () => {
    const meta = fitImgRef.current?.naturalWidth ? fitImgRef.current : placeImgRef.current;
    const place = placeImgRef.current;
    if (!meta?.naturalWidth || !meta.naturalHeight || !place) return null;
    const s0 = Math.min(place.offsetWidth / meta.naturalWidth, place.offsetHeight / meta.naturalHeight);
    return { w: meta.naturalWidth * s0, h: meta.naturalHeight * s0 };
  };

  const applyTransform = (animate: boolean) => {
    const el = zoomLayerRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)" : "none";
    el.style.transform = scaleRef.current === 1
      ? "translate3d(0,0,0) scale(1)"
      : `translate3d(${txRef.current}px, ${tyRef.current}px, 0) scale(${scaleRef.current})`;
  };

  // Keep the photo from being panned off-screen: when the scaled photo exceeds
  // the viewport it may pan edge-to-edge; when smaller it stays centred.
  const clampPan = () => {
    const dims = photoBaseDims();
    const s = scaleRef.current;
    const maxX = dims ? Math.max(0, (dims.w * s - window.innerWidth) / 2) : 0;
    const maxY = dims ? Math.max(0, (dims.h * s - window.innerHeight) / 2) : 0;
    txRef.current = Math.min(maxX, Math.max(-maxX, txRef.current));
    tyRef.current = Math.min(maxY, Math.max(-maxY, tyRef.current));
  };

  // Zoom to `next`, keeping the image point under (px, py) stationary.
  // The FIT box is flex-centred, so its centre == the viewport centre.
  const setScaleAt = (next: number, px: number, py: number, animate = false) => {
    const s = scaleRef.current;
    const ns = Math.min(MAX_SCALE, Math.max(1, next));
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    txRef.current = px - cx - ((px - cx - txRef.current) / s) * ns;
    tyRef.current = py - cy - ((py - cy - tyRef.current) / s) * ns;
    scaleRef.current = ns;
    if (ns === 1) { txRef.current = 0; tyRef.current = 0; }
    clampPan();
    applyTransform(animate);
    zoomedRef.current = ns > 1;
    setIsZoomed(ns > 1);
  };

  const resetZoom = (animate = true) => {
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    applyTransform(animate);
    zoomedRef.current = false;
    setIsZoomed(false);
  };

  const toggleZoom = (px?: number, py?: number) => {
    if (scaleRef.current > 1) resetZoom();
    else setScaleAt(2.5, px ?? window.innerWidth / 2, py ?? window.innerHeight / 2, true);
  };

  // Z1/Z2: where the photo actually renders inside the fitted (object-fit:
  // contain) box — clicks outside it are "background", clicks on its left /
  // right edges navigate, the middle toggles immersive mode.
  const visibleImageRect = () => {
    const meta = fitImgRef.current?.naturalWidth ? fitImgRef.current : placeImgRef.current;
    const box = placeImgRef.current?.getBoundingClientRect();
    if (!meta?.naturalWidth || !meta.naturalHeight || !box) return null;
    const scale = Math.min(box.width / meta.naturalWidth, box.height / meta.naturalHeight);
    const w = meta.naturalWidth * scale;
    const h = meta.naturalHeight * scale;
    return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
  };
  const onPhotoActivate = (e: React.MouseEvent) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    // The second click of a double-click (detail 2) belongs to the dblclick zoom
    // gesture — running the zone action too would e.g. navigate twice before
    // zooming when double-clicking near an edge.
    if (e.detail >= 2) return;
    if (scaleRef.current > 1) { resetZoom(); return; }
    // Keyboard activation (Enter/Space → detail 0) has no useful coordinates:
    // keep the documented behaviour of toggling the UI.
    if (e.detail === 0) { setChrome(c => !c); return; }
    const r = visibleImageRect();
    if (r) {
      const inside = e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h;
      if (!inside) { onClose(); return; } // letterbox around the photo = backdrop
      if (photos.length > 1) {
        const rel = (e.clientX - r.x) / r.w;
        if (rel < 0.28) { onPrev(); return; }
        if (rel > 0.72) { onNext(); return; }
      }
    }
    setChrome(c => !c);
  };

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();

    const onClick = (e: MouseEvent) => {
      if (e.target !== dlg) return;
      if (suppressClickRef.current) { suppressClickRef.current = false; return; }
      // Letterbox click while zoomed reads as "step back", not "leave the viewer".
      if (zoomedRef.current) resetZoom();
      else onClose();
    };

    // ── Pointer gestures: drag-to-pan (mouse + touch) and two-finger pinch. ──
    // touch-action: none on the dialog hands every gesture to us.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchPrev: { dist: number; mx: number; my: number } | null = null;
    let gestureMoved = false;
    let hadPinch = false;
    let lastTap = { t: 0, x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      // Chrome buttons (close / zoom / arrows) keep their plain click behaviour.
      if ((e.target as HTMLElement).closest?.("[data-lb-chrome]")) return;
      // A stale suppression (e.g. after pointercancel) must not eat this tap's click.
      if (pointers.size === 0) suppressClickRef.current = false;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      gestureMoved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchPrev = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        hadPinch = true;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) {
        pointers.set(e.pointerId, cur);
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (pinchPrev && pinchPrev.dist > 0) {
          // Incremental: zoom by the frame-to-frame distance ratio around the
          // current midpoint, then pan by the midpoint's drift.
          setScaleAt(scaleRef.current * (dist / pinchPrev.dist), mx, my);
          txRef.current += mx - pinchPrev.mx;
          tyRef.current += my - pinchPrev.my;
          clampPan();
          applyTransform(false);
        }
        pinchPrev = { dist, mx, my };
        gestureMoved = true;
      } else if (pointers.size === 1 && scaleRef.current > 1) {
        // One-finger / mouse-drag pan while zoomed.
        txRef.current += cur.x - prev.x;
        tyRef.current += cur.y - prev.y;
        clampPan();
        applyTransform(false);
        pointers.set(e.pointerId, cur);
        if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 1) gestureMoved = true;
      } else {
        pointers.set(e.pointerId, cur);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasLast = pointers.delete(e.pointerId) && pointers.size === 0;
      if (pointers.size < 2) pinchPrev = null;
      if (!wasLast) return;
      if (gestureMoved || hadPinch) {
        // A real pan/pinch happened — the browser will still fire click; eat it.
        suppressClickRef.current = true;
        touchRef.current = null; // and never treat it as a swipe
        hadPinch = false;
        return;
      }
      hadPinch = false;
      // Manual double-tap (touch only): iOS doesn't reliably synthesise dblclick
      // under touch-action: none. Toggles zoom at the tapped point.
      if (e.pointerType === "touch") {
        const now = Date.now();
        if (now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
          lastTap = { t: 0, x: 0, y: 0 };
          suppressClickRef.current = true;
          touchRef.current = null;
          toggleZoom(e.clientX, e.clientY);
        } else {
          lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
      }
    };

    // Mouse wheel / trackpad scroll zooms toward the cursor (PC).
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScaleAt(scaleRef.current * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    // Double-click zoom for mouse users (touch handled in onPointerUp).
    // Only in the photo's middle zone — the edges are prev/next click zones, so
    // the pair's first click has already navigated there and zooming the *new*
    // photo would feel random. While zoomed, anywhere toggles back.
    const onDblClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-lb-chrome]")) return;
      if (zoomedRef.current) { resetZoom(); return; }
      const r = visibleImageRect();
      if (r) {
        const inside = e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h;
        if (!inside) return;
        const rel = (e.clientX - r.x) / r.w;
        if (photos.length > 1 && (rel < 0.28 || rel > 0.72)) return;
      }
      toggleZoom(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (zoomedRef.current) { touchRef.current = null; return; } // panning, don't navigate
      if (!touchRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchRef.current.x;
      const dy = t.clientY - touchRef.current.y;
      const dt = Date.now() - touchRef.current.t;
      touchRef.current = null;
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > 50 || (Math.abs(dx) > 20 && dt < 250))) {
        if (dx < 0) onNext(); else onPrev();
      } else if (dy > 90 && dy > Math.abs(dx) * 1.5) {
        // Swipe down to dismiss — the expected mobile photo-viewer gesture. Safe
        // because the fitted (non-zoomed) view never scrolls vertically itself.
        onClose();
      }
    };
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("touchstart", onTouchStart, { passive: true });
    dlg.addEventListener("touchend", onTouchEnd);
    dlg.addEventListener("pointerdown", onPointerDown);
    dlg.addEventListener("pointermove", onPointerMove);
    dlg.addEventListener("pointerup", onPointerUp);
    dlg.addEventListener("pointercancel", onPointerUp);
    dlg.addEventListener("wheel", onWheel, { passive: false });
    dlg.addEventListener("dblclick", onDblClick);
    return () => {
      dlg.removeEventListener("click", onClick);
      dlg.removeEventListener("touchstart", onTouchStart);
      dlg.removeEventListener("touchend", onTouchEnd);
      dlg.removeEventListener("pointerdown", onPointerDown);
      dlg.removeEventListener("pointermove", onPointerMove);
      dlg.removeEventListener("pointerup", onPointerUp);
      dlg.removeEventListener("pointercancel", onPointerUp);
      dlg.removeEventListener("wheel", onWheel);
      dlg.removeEventListener("dblclick", onDblClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onNext, onPrev]);

  // Reset transient view state when the index changes.
  useEffect(() => {
    setImgError(false);
    setChrome(true);
    setHiRes(false);
    setZoomSrcReady(false);
    resetZoom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Preload the nearest neighbours (±2) so prev/next feels instant when paging.
  // Mirrors the visible image's srcset/sizes so the browser caches the exact
  // candidate it will pick when that photo is shown.
  useEffect(() => {
    const len = photos.length;
    if (len <= 1) return;
    for (const off of [1, -1, 2, -2]) {
      const img = new Image();
      // Low priority so prefetching neighbours never competes with the photo the
      // viewer is actually looking at (which is marked fetchpriority=high below).
      img.fetchPriority = "low";
      const url = photos[(index + off + len * 2) % len].url;
      img.sizes = FIT_SIZES;
      img.srcset = fitSrcSet(url);
      img.src = `${url}?w=1600&q=88`;
    }
  }, [index, photos]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Z2: the phone back gesture / browser back closes the viewer instead of
  // leaving the page, and the grid scroll position is restored on close.
  const onCloseRef = useRef(onClose);
  const historyPushedRef = useRef(false);
  const historyCleanupTimerRef = useRef<number | null>(null);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const scrollY = window.scrollY;
    const onPop = () => onCloseRef.current();
    if (historyCleanupTimerRef.current !== null) {
      window.clearTimeout(historyCleanupTimerRef.current);
      historyCleanupTimerRef.current = null;
    }
    if (!historyPushedRef.current) {
      window.history.pushState({ lightbox: true }, "");
      historyPushedRef.current = true;
    }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (historyCleanupTimerRef.current !== null) window.clearTimeout(historyCleanupTimerRef.current);
      // React StrictMode replays effects in dev: setup → cleanup → setup. Calling
      // history.back() synchronously in that replay closes the just-opened viewer
      // and looks like a black flicker. Defer the real cleanup; a replayed setup
      // clears this timer before it can navigate.
      historyCleanupTimerRef.current = window.setTimeout(() => {
        historyCleanupTimerRef.current = null;
        if (window.history.state?.lightbox) window.history.back();
        historyPushedRef.current = false;
        // After the body scroll lock above is released (cleanup order isn't
        // guaranteed, hence the rAF), put the viewer back where they were.
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }, 0);
    };
  }, []);

  // Arrow keys navigate; + / - / 0 zoom in, out and reset (keyboard parity with
  // wheel & pinch). Escape is handled by the dialog's onCancel.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "+" || e.key === "=") setScaleAt(scaleRef.current * 1.5, window.innerWidth / 2, window.innerHeight / 2, true);
      else if (e.key === "-") setScaleAt(scaleRef.current / 1.5, window.innerWidth / 2, window.innerHeight / 2, true);
      else if (e.key === "0") resetZoom();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPrev, onNext]);

  const photo = photos[index];

  // Chrome (overlay UI) fades out in immersive mode; also hidden while zoomed so
  // the detail view is unobstructed.
  const chromeOn = chrome && !isZoomed;
  const chromeVis = { opacity: chromeOn ? 1 : 0, pointerEvents: chromeOn ? "auto" as const : "none" as const, transition: "opacity 0.25s ease" };
  const chromeTab = chromeOn ? 0 : -1;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-label="写真ビューア"
      // Staged Escape (standard viewer behaviour): first Esc steps back out of
      // the zoom, the next one closes — closing instantly from a zoomed detail
      // view loses the spot the viewer was studying.
      onCancel={(e) => { e.preventDefault(); if (scaleRef.current > 1) resetZoom(); else onClose(); }}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: 0, padding: 0, border: "none", zIndex: 99999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", outline: "none" }}
    >
      {/* Counter — a polite live region so arrow/swipe navigation announces the
          new position to screen readers (the image swap itself is silent).
          Stays in the DOM while chrome is faded out, so announcements continue
          in immersive mode too. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ ...chromeVis, position: "absolute", top: "calc(18px + var(--sai-top))", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-en)", fontSize: 12, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", zIndex: 10 }}
      >
        {index + 1} / {photos.length}
        {/* Title for SR context; visually the caption block below shows it */}
        <span className="sr-only">{photos[index]?.title ? ` ${photos[index].title}` : ""}</span>
      </div>
      {/* Zoom toggle */}
      <button
        data-lb-chrome
        onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
        aria-label={isZoomed ? "ズームを解除" : "拡大して細部を見る"}
        tabIndex={chromeTab}
        style={{ ...chromeVis, position: "absolute", top: "calc(12px + var(--sai-top))", left: "calc(16px + var(--sai-left))", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 10, lineHeight: 0, zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          {isZoomed ? <line x1="8" y1="11" x2="14" y2="11" /> : <><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></>}
        </svg>
      </button>
      {/* Close */}
      {/* Z2: large, easy-to-hit close — ~52px target with a subtle scrim so it
          reads against bright photos. */}
      <button
        data-lb-chrome
        onClick={onClose}
        aria-label="閉じる"
        tabIndex={chromeTab}
        style={{ ...chromeVis, position: "absolute", top: "calc(10px + var(--sai-top))", right: "calc(12px + var(--sai-right))", width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", borderRadius: "50%", border: "none", cursor: "pointer", fontFamily: "var(--font-en)", fontSize: 26, color: "rgba(255,255,255,0.75)", lineHeight: 1, zIndex: 10 }}
        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,1)")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
      >✕</button>
      {/* Prev / Next */}
      {photos.length > 1 && (<>
        <button data-lb-chrome onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="前の写真" tabIndex={chromeTab} style={{ ...chromeVis, position: "absolute", left: "calc(6px + var(--sai-left))", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-en)", fontSize: 38, color: "rgba(255,255,255,0.45)", padding: "22px 16px", lineHeight: 1, zIndex: 10 }}>‹</button>
        <button data-lb-chrome onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="次の写真" tabIndex={chromeTab} style={{ ...chromeVis, position: "absolute", right: "calc(6px + var(--sai-right))", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-en)", fontSize: 38, color: "rgba(255,255,255,0.45)", padding: "22px 16px", lineHeight: 1, zIndex: 10 }}>›</button>
      </>)}

      {/* Photo. One fitted (object-fit: contain) box for every zoom level — the
          zoom layer is scaled/panned with a GPU transform, so wheel / pinch /
          drag never relayout. While zoomed a 3200px source fades in on top for
          true detail sharpness. */}
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, overflow: "hidden" }}>
        {imgError ? (
          <p style={{ fontFamily: "var(--font-en)", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>画像を読み込めませんでした</p>
        ) : (
          <div
            ref={zoomLayerRef}
            style={{ transformOrigin: "center center", willChange: "transform", lineHeight: 0 }}
          >
            {/* A <button> wrapper so the photo is keyboard-operable. */}
            <button
              type="button"
              onClick={onPhotoActivate}
              aria-label={isZoomed ? "ズームを解除" : (chrome ? "UIを隠して写真だけ表示" : "UIを表示")}
              style={{ position: "relative", background: "none", border: "none", padding: 0, margin: 0, display: "block", lineHeight: 0, cursor: isZoomed ? "grab" : "pointer" }}
            >
              {/* Blur-up: a tiny placeholder (usually already cached from the grid's
                  srcset) loads near-instantly and is blurred until the full image fades
                  in on top — so the photo appears immediately. The box is a fixed
                  ~95% of the viewport (object-fit: contain) rather than the
                  placeholder's tiny natural size, so the photo renders large (R2). */}
              <img
                ref={placeImgRef}
                src={`${photo.url}?w=400&q=55`}
                alt=""
                aria-hidden="true"
                draggable={false}
                fetchPriority="low"
                decoding="async"
                style={{ display: "block", width: FIT_W, height: FIT_H, objectFit: "contain", filter: hiRes ? "blur(0px)" : "blur(14px)", transform: hiRes ? "scale(1)" : "scale(1.03)", transition: "filter 0.45s ease, transform 0.45s ease" }}
              />
              <img
                ref={fitImgRef}
                src={`${photo.url}?w=1600&q=88`}
                srcSet={fitSrcSet(photo.url)}
                sizes={FIT_SIZES}
                alt={photo.title || photo.meta || `Photograph ${index + 1}`}
                onLoad={() => setHiRes(true)}
                onError={() => setImgError(true)}
                fetchPriority="high"
                decoding="async"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: hiRes ? 1 : 0, transition: "opacity 0.45s ease" }}
                draggable={false}
              />
              {/* Sharpness overlay while zoomed: the stored maximum (3200px). Fades
                  in over the fitted image; scales with the same transform. */}
              {isZoomed && (
                <img
                  src={`${photo.url}?w=3200&q=90`}
                  alt=""
                  aria-hidden="true"
                  onLoad={() => setZoomSrcReady(true)}
                  decoding="async"
                  draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: zoomSrcReady ? 1 : 0, transition: "opacity 0.3s ease" }}
                />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Caption — overlaid at the bottom so it never shrinks the photo; part of chrome. */}
      {(photo.title || photo.camera || photo.lens || photo.filmType) && (
        <div style={{ ...chromeVis, position: "absolute", bottom: "calc(18px + var(--sai-bottom))", left: "50%", transform: "translateX(-50%)", maxWidth: "90vw", textAlign: "center", zIndex: 10, textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}>
          {photo.title && (
            <p style={{ fontFamily: "var(--font-en)", fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>{photo.title}</p>
          )}
          {(() => {
            const info = [photo.camera, photo.lens, photo.filmType].filter(Boolean).join("  ·  ");
            return info ? (
              <p style={{ fontFamily: "var(--font-en)", fontSize: 10.5, color: "rgba(255,255,255,0.35)", marginTop: 4, letterSpacing: "0.06em" }}>{info}</p>
            ) : null;
          })()}
        </div>
      )}
    </dialog>,
    document.body
  );
}
