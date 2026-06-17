import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { buildGalleryLayout, tileWidth } from "../lib/gallery-layout";
import { num, clamp } from "../lib/utils";
import { Lightbox, FIT_SIZES, fitSrcSet } from "./Lightbox";

export type GalleryPhoto = {
  id: number;
  url: string;
  title: string;
  meta?: string;
  filename?: string;
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
  displaySize?: string;
  width?: number | null;
  height?: number | null;
};

// N1/N4: the selectable grid layouts. Unknown / unset values fall back to mosaic.
export type GalleryLayoutType = "mosaic" | "grid" | "scroll" | "stagger" | "editorial" | "collage";
const KNOWN_LAYOUTS: GalleryLayoutType[] = ["mosaic", "grid", "scroll", "stagger", "editorial", "collage"];

/**
 * Photo grid + lightbox (グループG / N). Shared by the Gallery and Series pages.
 * `layoutType` chooses the arrangement (admin-tunable per page); the lightbox,
 * preloading and tile rendering are shared across all layouts.
 */
export function PhotoGallery({ photos, layoutType, variant = "gallery" }: { photos: GalleryPhoto[]; layoutType?: string; variant?: "top" | "gallery" }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });

  // Track the breakpoint so the layout matches the screen in use. Seeded from
  // window so the first paint already matches (no reflow on real mobile).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // W: columns derive from the container width — the admin sets a *maximum*,
  // and the count steps down automatically so tiles never get narrower than a
  // minimum width (phones land on 1–2, tablets ~3, wide desktops up to the max).
  // X: top (Works) and gallery read independent keys; the top falls back to the
  // gallery's values so existing sites look unchanged until 秋 splits them.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(
    () => (typeof window !== "undefined" ? Math.min(window.innerWidth - 48, 976) : 976)
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return; // old browsers keep the initial estimate
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isTop = variant === "top";
  const pick = (topKey: string, galleryKey: string, fallback: number) => {
    const s = settings as Record<string, string> | undefined;
    const topVal = isTop ? num(s?.[topKey], NaN) : NaN;
    return Number.isFinite(topVal) && (s?.[topKey] ?? "") !== "" ? topVal : num(s?.[galleryKey], fallback);
  };

  const gapScale = clamp(pick("topWorksGapScale", "galleryGapScale", 1), 0.2, 3);
  const emptyRate = clamp(num(settings?.galleryEmptyRate, 0.1), 0, 0.4);
  const sizeVariation = clamp(num(settings?.gallerySizeVariation, 0.5), 0, 1);
  const sizeScale = clamp(pick("topWorksSizeScale", "gallerySizeScale", 1), 0.5, 2);
  const maxColumns = clamp(Math.round(pick("topWorksColumns", "galleryColumns", 3)), 1, 8);
  // Larger sizeScale → wider minimum tile → fewer columns → bigger photos.
  const minTile = (isMobile ? 150 : 210) * sizeScale;
  const columns = clamp(Math.floor(containerW / minTile) || 1, 1, maxColumns);
  const seed = Math.round(num(settings?.gallerySeed, 1));
  const mode: GalleryLayoutType = KNOWN_LAYOUTS.includes(layoutType as GalleryLayoutType)
    ? (layoutType as GalleryLayoutType)
    : "mosaic";

  const mosaicCells = useMemo(
    () => buildGalleryLayout(photos.length, photos.map((p) => p.id), { columns, emptyRate, seed, isMobile }),
    [photos, columns, emptyRate, seed, isMobile]
  );

  // Close the lightbox if the photo set changes (e.g. filter switch).
  useEffect(() => { setLightboxIndex(null); }, [photos]);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  if (photos.length === 0) return null;

  // One clickable tile, shared by every layout (identical loading / lqip / preload).
  // `staggerIdx` orders the fade-in; defaults to the photo index. Layouts whose DOM
  // order isn't the visual reading order (CSS columns = column-major) pass their
  // own row-major order so photos appear 左→右, 上→下.
  const tile = (photo: GalleryPhoto, idx: number, opts: { width: string; justifySelf: string; sizes: string; staggerIdx?: number }) => {
    const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : undefined;
    return (
      <button
        key={photo.id}
        type="button"
        aria-label={photo.title || photo.meta || photo.filename || "写真を開く"}
        style={{ justifySelf: opts.justifySelf, width: opts.width, display: "block", padding: 0, border: "none", background: "none", font: "inherit", textAlign: "inherit", cursor: "pointer" }}
        onClick={() => openLightbox(idx)}
        // Warm the full-size image on hover-intent so the lightbox opens instantly.
        // Mirrors the lightbox's srcset/sizes so the browser caches the same candidate.
        onMouseEnter={() => { const img = new Image(); img.fetchPriority = "low"; img.sizes = FIT_SIZES; img.srcset = fitSrcSet(photo.url); img.src = `${photo.url}?w=1600&q=88`; }}
      >
        <div
          className="photo-card fade-in-item"
          style={{ "--stagger-delay": `${Math.min((opts.staggerIdx ?? idx) * 0.05, 0.4)}s` } as React.CSSProperties}
        >
          <img
            src={`${photo.url}?w=600&q=84`}
            srcSet={`${photo.url}?w=400&q=82 400w, ${photo.url}?w=800&q=84 800w, ${photo.url}?w=1200&q=84 1200w, ${photo.url}?w=1600&q=86 1600w`}
            sizes={opts.sizes}
            alt={photo.title || photo.meta || photo.filename || `Photograph ${idx + 1}`}
            loading={idx < 6 ? "eager" : "lazy"}
            fetchPriority={idx === 0 ? "high" : undefined}
            decoding="async"
            width={photo.width || undefined}
            height={photo.height || undefined}
            style={ratio ? { aspectRatio: ratio, width: "100%", height: "auto" } : undefined}
            className="lqip-loading"
            onLoad={(e) => { const el = e.currentTarget; el.classList.remove("lqip-loading"); el.classList.add("lqip-loaded"); }}
            onError={(e) => { const el = e.currentTarget; el.classList.remove("lqip-loading"); el.classList.add("lqip-loaded"); el.closest(".photo-card")?.classList.add("photo-broken"); }}
          />
          {/* Hover-reveal title (CSS shows it on pointer devices only) */}
          {photo.title && <span className="tile-caption" aria-hidden="true">{photo.title}</span>}
        </div>
      </button>
    );
  };

  const colGap = (isMobile ? 24 : 40) * gapScale;
  const rowGap = (isMobile ? 48 : 80) * gapScale;
  const gridSizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

  let body: React.ReactNode;
  if (mode === "grid") {
    // N3 grid: every photo the same, evenly aligned. Ignores S/M/L.
    body = (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: `${colGap}px`, rowGap: `${rowGap}px`, alignItems: "start" }}>
        {photos.map((photo, idx) => tile(photo, idx, { width: "100%", justifySelf: "stretch", sizes: gridSizes }))}
      </div>
    );
  } else if (mode === "scroll") {
    // N3 scroll: one photo at a time, large, with a caption below. Photo-book feel.
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${(isMobile ? 56 : 110) * gapScale}px` }}>
        {photos.map((photo, idx) => {
          const info = [photo.camera, photo.lens, photo.filmType].filter(Boolean).join("  ·  ");
          return (
            <figure key={photo.id} style={{ width: isMobile ? "100%" : "78%", maxWidth: 1080, margin: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {tile(photo, idx, { width: "100%", justifySelf: "stretch", sizes: isMobile ? "100vw" : "80vw" })}
              {(photo.title || info) && (
                <figcaption style={{ marginTop: 14, textAlign: "center" }}>
                  {photo.title && <p className="font-en" style={{ fontSize: 12, letterSpacing: "0.04em", color: "rgba(var(--foreground-rgb),0.55)" }}>{photo.title}</p>}
                  {info && <p className="font-en" style={{ fontSize: 10.5, marginTop: 3, letterSpacing: "0.06em", color: "rgba(var(--foreground-rgb),0.32)" }}>{info}</p>}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    );
  } else if (mode === "stagger") {
    // N3 stagger: one large photo at a time, alternating left / right (zig-zag).
    // Mobile keeps the zig-zag (slightly wider tiles) so the layout reads the same.
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: `${(isMobile ? 48 : 90) * gapScale}px` }}>
        {photos.map((photo, idx) => (
          <div key={photo.id} style={{ width: isMobile ? "88%" : "82%", alignSelf: idx % 2 === 0 ? "flex-start" : "flex-end" }}>
            {tile(photo, idx, { width: "100%", justifySelf: "stretch", sizes: isMobile ? "88vw" : "82vw" })}
          </div>
        ))}
      </div>
    );
  } else if (mode === "editorial") {
    // N3 editorial: photos paired two-up (left larger, right smaller, offset down),
    // big gaps between pairs; a lone trailing photo is centred.
    const pairs: GalleryPhoto[][] = [];
    for (let i = 0; i < photos.length; i += 2) pairs.push(photos.slice(i, i + 2));
    // Mobile keeps the two-up spread (large-left / small-right offset) so the
    // editorial character survives the narrow screen — stacking it made the
    // layout indistinguishable from "scroll".
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: `${(isMobile ? 56 : 104) * gapScale}px` }}>
        {pairs.map((pair, pi) =>
          pair.length === 1 ? (
            <div key={pair[0].id} style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: isMobile ? "88%" : "60%" }}>{tile(pair[0], pi * 2, { width: "100%", justifySelf: "stretch", sizes: isMobile ? "88vw" : "60vw" })}</div>
            </div>
          ) : (
            <div key={pair[0].id} style={{ display: "flex", flexDirection: "row", gap: `${(isMobile ? 12 : 48) * gapScale}px`, alignItems: "flex-start" }}>
              <div style={{ width: isMobile ? "58%" : "56%", flexShrink: 0 }}>{tile(pair[0], pi * 2, { width: "100%", justifySelf: "stretch", sizes: isMobile ? "58vw" : "56vw" })}</div>
              <div style={{ width: isMobile ? "36%" : "38%", flexShrink: 0, marginTop: isMobile ? "9%" : "7%" }}>{tile(pair[1], pi * 2 + 1, { width: "100%", justifySelf: "stretch", sizes: isMobile ? "36vw" : "38vw" })}</div>
            </div>
          )
        )}
      </div>
    );
  } else if (mode === "collage") {
    // N4 collage: snapshot pile — gentle tilt, white border, slight overlap, later
    // photos stacked on top (z-index) so the topmost is the click target. Mobile
    // keeps the same character, just dialled down (smaller tilt / overlap).
    const overlap = isMobile ? 6 : 13;
    body = (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: `${colGap}px`, rowGap: `${Math.max(0, rowGap - overlap)}px`, alignItems: "start" }}>
        {photos.map((photo, idx) => {
          const tilt = isMobile ? ((photo.id * 53) % 5) - 2 : ((photo.id * 53) % 9) - 4; // ±2deg mobile / ±4deg PC
          const shift = ((idx % 3) - 1) * overlap; // nudge L/M/R to overlap neighbours
          return (
            <div
              key={photo.id}
              className="collage-card"
              style={{
                position: "relative",
                zIndex: idx + 1,
                "--collage-shift": `${shift}px`,
                "--collage-tilt": `${tilt}deg`,
                background: "#fff",
                padding: isMobile ? 4 : 5,
                boxShadow: isMobile ? "0 3px 10px rgba(0,0,0,0.18)" : "0 5px 16px rgba(0,0,0,0.22)",
              } as React.CSSProperties}
            >
              {tile(photo, idx, { width: "100%", justifySelf: "stretch", sizes: gridSizes })}
            </div>
          );
        })}
      </div>
    );
  } else {
    // mosaic (default): controlled-random S/M/L with intentional gaps ("抜け感").
    body = (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: `${colGap}px`, rowGap: `${rowGap}px`, alignItems: "start" }}>
        {mosaicCells.map((cell, i) => {
          if (cell.type === "gap") return <div key={`gap-${i}`} aria-hidden="true" />;
          const idx = cell.photoIndex;
          const photo = photos[idx];
          const size = (photo.displaySize || "M") as "S" | "M" | "L";
          const col = i % columns;
          // design-spec 2-3: S/M/L の相対関係はモバイルでも維持（L は全幅）。
          const w = size === "L" ? "100%" : tileWidth(size, sizeVariation);
          const justifySelf = size === "L" ? "stretch" : (["start", "center", "end"][col % 3]);
          return tile(photo, idx, { width: w, justifySelf, sizes: gridSizes });
        })}
      </div>
    );
  }

  return (
    <>
      {/* W: the ref feeds the ResizeObserver that derives the column count. */}
      <div ref={containerRef}>{body}</div>
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
