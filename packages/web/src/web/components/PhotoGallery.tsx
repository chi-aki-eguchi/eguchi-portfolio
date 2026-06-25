import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { buildGalleryLayout, tileWidth } from "../lib/gallery-layout";
import { num, clamp } from "../lib/utils";
import { Lightbox, FIT_SIZES } from "./Lightbox";
import { srcSetFor } from "../lib/picture";

const _preloaded = new Set<string>();
function preloadForLightbox(url: string, mediumUrl?: string | null) {
  const key = mediumUrl || url;
  if (_preloaded.has(key)) return;
  _preloaded.add(key);
  const img = new Image();
  if (mediumUrl) {
    img.src = mediumUrl;
  } else {
    img.sizes = FIT_SIZES;
    img.srcset = srcSetFor(url, "lightbox", "webp");
    img.src = `${url}?w=1920&q=85&fmt=webp`;
  }
  img.fetchPriority = "low";
  img.decoding = "async";
}

function preloadNearbyLightboxPhotos(photos: GalleryPhoto[], index: number) {
  const len = photos.length;
  if (len === 0) return;
  for (const off of [0, 1, -1, 2, -2, 3, -3]) {
    const photo = photos[(index + off + len * 2) % len];
    if (!photo) continue;
    preloadForLightbox(photo.url, photo.mediumUrl);
  }
}

export type GalleryPhoto = {
  id: number;
  url: string;
  title: string;
  meta?: string;
  filename?: string;
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
  shotAt?: string | null;
  displaySize?: string;
  width?: number | null;
  height?: number | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

// N1/N4: the selectable grid layouts. Unknown / unset values fall back to mosaic.
export type GalleryLayoutType =
  | "mosaic"
  | "grid"
  | "scroll"
  | "stagger"
  | "editorial"
  | "collage"
  | "clean-grid"
  | "masonry"
  | "large-format";
const KNOWN_LAYOUTS: GalleryLayoutType[] = [
  "mosaic",
  "grid",
  "scroll",
  "stagger",
  "editorial",
  "collage",
  "clean-grid",
  "masonry",
  "large-format",
];

const LqipImage = memo(function LqipImage({
  url,
  thumbUrl,
  alt,
  sizes,
  isNearViewport,
  isFirst,
  width,
  height,
  style,
}: {
  url: string;
  thumbUrl?: string | null;
  alt: string;
  sizes: string;
  isNearViewport: boolean;
  isFirst: boolean;
  width: number | null | undefined;
  height: number | null | undefined;
  style?: React.CSSProperties;
}) {
  const [loaded, setLoaded] = useState(false);
  const swappedRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    swappedRef.current = false;
  }, [url]);

  const swapToGridImage = useCallback(
    (el: HTMLImageElement, keepCurrentSharp = false) => {
      if (swappedRef.current) {
        setLoaded(true);
        return;
      }
      const realSrc = el.dataset.src;
      if (!realSrc) {
        swappedRef.current = true;
        setLoaded(true);
        return;
      }
      const realSrcset = el.dataset.srcset;
      if (keepCurrentSharp) setLoaded(true);
      const full = new Image();
      full.onload = () => {
        swappedRef.current = true;
        el.srcset = realSrcset || "";
        el.src = realSrc;
        setLoaded(true);
      };
      full.src = realSrc;
      if (realSrcset) full.srcset = realSrcset;
      full.sizes = sizes;
    },
    [sizes],
  );

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      swapToGridImage(e.currentTarget);
    },
    [swapToGridImage],
  );

  // Use the pre-generated WebP as the instant first paint, then silently upgrade
  // to the responsive grid source so large/editorial layouts stay crisp.
  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        data-src={`${url}?w=600&q=84`}
        data-srcset={srcSetFor(url, "grid")}
        sizes={sizes}
        alt={alt}
        loading={isNearViewport ? "eager" : "lazy"}
        fetchPriority={isFirst ? "high" : undefined}
        decoding="async"
        width={width || undefined}
        height={height || undefined}
        style={style}
        className={loaded ? "lqip-loaded" : "lqip-loading"}
        onLoad={(e) => swapToGridImage(e.currentTarget, true)}
        onError={(e) => {
          setLoaded(true);
          e.currentTarget.closest(".photo-card")?.classList.add("photo-broken");
        }}
      />
    );
  }

  return (
    <img
      src={isNearViewport ? `${url}?w=600&q=84` : `${url}?w=20&q=20`}
      data-src={isNearViewport ? undefined : `${url}?w=600&q=84`}
      srcSet={isNearViewport ? srcSetFor(url, "grid") : undefined}
      data-srcset={isNearViewport ? undefined : srcSetFor(url, "grid")}
      sizes={sizes}
      alt={alt}
      loading={isNearViewport ? "eager" : "lazy"}
      fetchPriority={isFirst ? "high" : undefined}
      decoding="async"
      width={width || undefined}
      height={height || undefined}
      style={style}
      className={loaded ? "lqip-loaded" : "lqip-loading"}
      onLoad={onLoad}
      onError={(e) => {
        setLoaded(true);
        e.currentTarget.closest(".photo-card")?.classList.add("photo-broken");
      }}
    />
  );
});

/**
 * Photo grid + lightbox (グループG / N). Shared by the Gallery and Series pages.
 * `layoutType` chooses the arrangement (admin-tunable per page); the lightbox,
 * preloading and tile rendering are shared across all layouts.
 */
export function PhotoGallery({
  photos,
  layoutType,
  variant = "gallery",
  onRequestMore,
}: {
  photos: GalleryPhoto[];
  layoutType?: string;
  variant?: "top" | "gallery";
  onRequestMore?: () => void;
}) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceResourceTiming;
        if (
          e.initiatorType !== "img" &&
          e.initiatorType !== "css" &&
          e.initiatorType !== "fetch"
        )
          continue;
        const url = e.name;
        const isImage =
          url.includes("/api/images/") ||
          url.includes("/thumbs/") ||
          url.includes("/medium/") ||
          url.includes("/photos/");
        const isApi = url.includes("/api/photos");
        if (!isImage && !isApi) continue;
        const ttfb = Math.round(e.responseStart - e.requestStart);
        const download = Math.round(e.responseEnd - e.responseStart);
        const total = Math.round(e.responseEnd - e.startTime);
        const size = e.transferSize
          ? `${Math.round(e.transferSize / 1024)}KB`
          : "cached";
        const source = url.includes("/api/images/")
          ? "proxy"
          : url.startsWith("http")
            ? "R2"
            : "local";
        const short = url.length > 80 ? `…${url.slice(-60)}` : url;
        console.debug(
          `[perf] ${source} TTFB=${ttfb}ms DL=${download}ms total=${total}ms ${size} ${short}`,
        );
      }
    });
    observer.observe({ type: "resource", buffered: false });
    return () => observer.disconnect();
  }, []);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Track the ID of the photo that is currently open so we can detect real
  // filter-switches (photo disappears from the set) vs. array growth from
  // infinite scroll (existing photos stay, new ones are appended at the end).
  const openPhotoIdRef = useRef<number | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });

  // Track the breakpoint so the layout matches the screen in use. Seeded from
  // window so the first paint already matches (no reflow on real mobile).
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
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
  const [containerW, setContainerW] = useState(() =>
    typeof window !== "undefined" ? Math.min(window.innerWidth - 48, 976) : 976,
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
    return Number.isFinite(topVal) && (s?.[topKey] ?? "") !== ""
      ? topVal
      : num(s?.[galleryKey], fallback);
  };

  const gapScale = clamp(
    pick("topWorksGapScale", "galleryGapScale", 1),
    0.2,
    3,
  );
  const emptyRate = clamp(num(settings?.galleryEmptyRate, 0.1), 0, 0.4);
  const sizeVariation = clamp(num(settings?.gallerySizeVariation, 0.5), 0, 1);
  const sizeScale = clamp(
    pick("topWorksSizeScale", "gallerySizeScale", 1),
    0.5,
    2,
  );
  const maxColumns = clamp(
    Math.round(pick("topWorksColumns", "galleryColumns", 3)),
    1,
    8,
  );
  // Larger sizeScale → wider minimum tile → fewer columns → bigger photos.
  const minTile = (isMobile ? 150 : 210) * sizeScale;
  const columns = clamp(Math.floor(containerW / minTile) || 1, 1, maxColumns);
  const seed = Math.round(num(settings?.gallerySeed, 1));
  const mode: GalleryLayoutType = KNOWN_LAYOUTS.includes(
    layoutType as GalleryLayoutType,
  )
    ? (layoutType as GalleryLayoutType)
    : "mosaic";

  const mosaicCells = useMemo(
    () =>
      buildGalleryLayout(
        photos.length,
        photos.map((p) => p.id),
        { columns, emptyRate, seed, isMobile },
      ),
    [photos, columns, emptyRate, seed, isMobile],
  );

  // Close only when the currently-open photo disappears from the set (filter
  // switch). Do NOT close when photos are merely appended (top-page infinite
  // scroll grows the array, so the open photo is still at the same index).
  useEffect(() => {
    if (lightboxIndex === null) return;
    const id = openPhotoIdRef.current;
    if (id !== null && !photos.some((p) => p.id === id)) {
      setLightboxIndex(null);
    }
  }, [photos, lightboxIndex]);

  const openLightbox = (idx: number) => {
    openPhotoIdRef.current = photos[idx]?.id ?? null;
    preloadNearbyLightboxPhotos(photos, idx);
    setLightboxIndex(idx);
  };
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null) return null;
      const ni = (i - 1 + photos.length) % photos.length;
      openPhotoIdRef.current = photos[ni]?.id ?? null;
      return ni;
    });
  }, [photos]);
  const onRequestMoreRef = useRef(onRequestMore);
  onRequestMoreRef.current = onRequestMore;
  const next = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null) return null;
      if (i >= photos.length - 1) {
        if (onRequestMoreRef.current) {
          onRequestMoreRef.current();
          return i;
        }
      }
      const ni = (i + 1) % photos.length;
      openPhotoIdRef.current = photos[ni]?.id ?? null;
      return ni;
    });
  }, [photos]);

  if (photos.length === 0) return null;

  // One clickable tile, shared by every layout (identical loading / lqip / preload).
  // `staggerIdx` orders the fade-in; defaults to the photo index. Layouts whose DOM
  // order isn't the visual reading order (CSS columns = column-major) pass their
  // own row-major order so photos appear 左→右, 上→下.
  const tile = (
    photo: GalleryPhoto,
    idx: number,
    opts: {
      width: string;
      justifySelf: string;
      sizes: string;
      staggerIdx?: number;
      cardClassName?: string;
      imgStyle?: React.CSSProperties;
      showHoverCaption?: boolean;
    },
  ) => {
    const ratio =
      photo.width && photo.height
        ? `${photo.width} / ${photo.height}`
        : undefined;
    const imgStyle =
      opts.imgStyle ??
      (ratio
        ? { aspectRatio: ratio, width: "100%", height: "auto" }
        : undefined);
    const isNearViewport = idx < 8;
    return (
      <button
        key={photo.id}
        type="button"
        aria-label={photo.title || photo.meta || photo.filename || "写真を開く"}
        style={{
          justifySelf: opts.justifySelf,
          width: opts.width,
          display: "block",
          padding: 0,
          border: "none",
          background: "none",
          font: "inherit",
          textAlign: "inherit",
          cursor: "pointer",
        }}
        onClick={() => openLightbox(idx)}
        onMouseEnter={() => preloadForLightbox(photo.url, photo.mediumUrl)}
        onPointerDown={() => preloadNearbyLightboxPhotos(photos, idx)}
        onTouchStart={() => preloadForLightbox(photo.url, photo.mediumUrl)}
      >
        <div
          className={`photo-card fade-in-item${opts.cardClassName ? ` ${opts.cardClassName}` : ""}`}
          style={
            {
              "--stagger-delay": `${Math.min((opts.staggerIdx ?? idx) * 0.05, 0.4)}s`,
              ...(ratio ? { aspectRatio: ratio } : {}),
            } as React.CSSProperties
          }
        >
          <picture>
            {isNearViewport && !photo.thumbUrl && (
              <>
                <source
                  type="image/avif"
                  srcSet={srcSetFor(photo.url, "grid", "avif")}
                  sizes={opts.sizes}
                />
                <source
                  type="image/webp"
                  srcSet={srcSetFor(photo.url, "grid", "webp")}
                  sizes={opts.sizes}
                />
              </>
            )}
            <LqipImage
              url={photo.url}
              thumbUrl={photo.thumbUrl}
              alt={
                photo.title ||
                photo.meta ||
                photo.filename ||
                `Photograph ${idx + 1}`
              }
              sizes={opts.sizes}
              isNearViewport={isNearViewport}
              isFirst={idx === 0}
              width={photo.width}
              height={photo.height}
              style={imgStyle}
            />
          </picture>
          {(opts.showHoverCaption ?? true) && photo.title && (
            <span className="tile-caption" aria-hidden="true">
              {photo.title}
            </span>
          )}
        </div>
      </button>
    );
  };

  const colGap = (isMobile ? 24 : 40) * gapScale;
  const rowGap = (isMobile ? 48 : 80) * gapScale;
  const gridSizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
  const quietCardClass = "photo-card-quiet";
  const squareCoverStyle: React.CSSProperties = {
    aspectRatio: "1 / 1",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  const displayMedium = (photo: GalleryPhoto) => {
    if (photo.filmType === "フィルム") return "Film";
    if (photo.filmType === "デジタル") return "Digital";
    return photo.filmType || "";
  };
  const photoYear = (photo: GalleryPhoto) => {
    if (!photo.shotAt) return "";
    const y = new Date(photo.shotAt).getFullYear();
    return Number.isFinite(y) ? String(y) : "";
  };

  let body: React.ReactNode;
  if (mode === "clean-grid") {
    // Layout expansion Phase 1: no frames, no rotation, almost no gap. A pure
    // contact-sheet view where the photos carry the page.
    const cols = isMobile ? 2 : 4;
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: 2,
          padding: 2,
          alignItems: "start",
        }}
      >
        {photos.map((photo, idx) =>
          tile(photo, idx, {
            width: "100%",
            justifySelf: "stretch",
            sizes: isMobile ? "50vw" : "25vw",
            cardClassName: quietCardClass,
            imgStyle: squareCoverStyle,
            showHoverCaption: false,
          }),
        )}
      </div>
    );
  } else if (mode === "masonry") {
    // Layout expansion Phase 1: CSS columns preserve each photo's real aspect
    // ratio with a quiet hover title. DOM order remains the same; visual flow is
    // column-major, acceptable for a masonry index.
    const cols = isMobile ? 2 : 3;
    body = (
      <div style={{ columnCount: cols, columnGap: 8 }}>
        {photos.map((photo, idx) => (
          <div key={photo.id} style={{ breakInside: "avoid", marginBottom: 8 }}>
            {tile(photo, idx, {
              width: "100%",
              justifySelf: "stretch",
              sizes: isMobile ? "50vw" : "33vw",
              cardClassName: quietCardClass,
            })}
          </div>
        ))}
      </div>
    );
  } else if (mode === "large-format") {
    // Layout expansion Phase 1: exhibition-like large images with quiet metadata.
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
          columnGap: 20,
          rowGap: isMobile ? 34 : 46,
          alignItems: "start",
        }}
      >
        {photos.map((photo, idx) => {
          const medium = displayMedium(photo);
          const year = photoYear(photo);
          const sub = [medium, year].filter(Boolean).join(" — ");
          return (
            <figure key={photo.id} style={{ margin: 0 }}>
              {tile(photo, idx, {
                width: "100%",
                justifySelf: "stretch",
                sizes: isMobile ? "100vw" : "50vw",
                cardClassName: quietCardClass,
                showHoverCaption: false,
              })}
              {(photo.title || sub) && (
                <figcaption style={{ marginTop: 9 }}>
                  {photo.title && (
                    <p
                      className="font-en"
                      style={{
                        margin: 0,
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        lineHeight: 1.45,
                        color: "#1a1a1a",
                      }}
                    >
                      {photo.title}
                    </p>
                  )}
                  {sub && (
                    <p
                      className="font-en"
                      style={{
                        margin: "2px 0 0",
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        lineHeight: 1.45,
                        color: "#bbb",
                      }}
                    >
                      {sub}
                    </p>
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    );
  } else if (mode === "grid") {
    // N3 grid: every photo the same, evenly aligned. Ignores S/M/L.
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          columnGap: `${colGap}px`,
          rowGap: `${rowGap}px`,
          alignItems: "start",
        }}
      >
        {photos.map((photo, idx) =>
          tile(photo, idx, {
            width: "100%",
            justifySelf: "stretch",
            sizes: gridSizes,
          }),
        )}
      </div>
    );
  } else if (mode === "scroll") {
    // N3 scroll: one photo at a time, large, with a caption below. Photo-book feel.
    body = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: `${(isMobile ? 56 : 110) * gapScale}px`,
        }}
      >
        {photos.map((photo, idx) => {
          const info = [photo.camera, photo.lens, photo.filmType]
            .filter(Boolean)
            .join("  ·  ");
          return (
            <figure
              key={photo.id}
              style={{
                width: isMobile ? "100%" : "78%",
                maxWidth: 1080,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {tile(photo, idx, {
                width: "100%",
                justifySelf: "stretch",
                sizes: isMobile ? "100vw" : "80vw",
              })}
              {(photo.title || info) && (
                <figcaption style={{ marginTop: 14, textAlign: "center" }}>
                  {photo.title && (
                    <p
                      className="font-en"
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.04em",
                        color: "rgba(var(--foreground-rgb),0.55)",
                      }}
                    >
                      {photo.title}
                    </p>
                  )}
                  {info && (
                    <p
                      className="font-en"
                      style={{
                        fontSize: 10.5,
                        marginTop: 3,
                        letterSpacing: "0.06em",
                        color: "rgba(var(--foreground-rgb),0.32)",
                      }}
                    >
                      {info}
                    </p>
                  )}
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${(isMobile ? 48 : 90) * gapScale}px`,
        }}
      >
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            style={{
              width: isMobile ? "88%" : "82%",
              alignSelf: idx % 2 === 0 ? "flex-start" : "flex-end",
            }}
          >
            {tile(photo, idx, {
              width: "100%",
              justifySelf: "stretch",
              sizes: isMobile ? "88vw" : "82vw",
            })}
          </div>
        ))}
      </div>
    );
  } else if (mode === "editorial") {
    // N3 editorial: photos paired two-up (left larger, right smaller, offset down),
    // big gaps between pairs; a lone trailing photo is centred.
    const pairs: GalleryPhoto[][] = [];
    for (let i = 0; i < photos.length; i += 2)
      pairs.push(photos.slice(i, i + 2));
    // Mobile keeps the two-up spread (large-left / small-right offset) so the
    // editorial character survives the narrow screen — stacking it made the
    // layout indistinguishable from "scroll".
    body = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${(isMobile ? 56 : 104) * gapScale}px`,
        }}
      >
        {pairs.map((pair, pi) =>
          pair.length === 1 ? (
            <div
              key={pair[0].id}
              style={{ display: "flex", justifyContent: "center" }}
            >
              <div style={{ width: isMobile ? "88%" : "60%" }}>
                {tile(pair[0], pi * 2, {
                  width: "100%",
                  justifySelf: "stretch",
                  sizes: isMobile ? "88vw" : "60vw",
                })}
              </div>
            </div>
          ) : (
            <div
              key={pair[0].id}
              style={{
                display: "flex",
                flexDirection: "row",
                gap: `${(isMobile ? 12 : 48) * gapScale}px`,
                alignItems: "flex-start",
              }}
            >
              <div style={{ width: isMobile ? "58%" : "56%", flexShrink: 0 }}>
                {tile(pair[0], pi * 2, {
                  width: "100%",
                  justifySelf: "stretch",
                  sizes: isMobile ? "58vw" : "56vw",
                })}
              </div>
              <div
                style={{
                  width: isMobile ? "36%" : "38%",
                  flexShrink: 0,
                  marginTop: isMobile ? "9%" : "7%",
                }}
              >
                {tile(pair[1], pi * 2 + 1, {
                  width: "100%",
                  justifySelf: "stretch",
                  sizes: isMobile ? "36vw" : "38vw",
                })}
              </div>
            </div>
          ),
        )}
      </div>
    );
  } else if (mode === "collage") {
    // N4 collage: snapshot pile — gentle tilt, white border, slight overlap, later
    // photos stacked on top (z-index) so the topmost is the click target. Mobile
    // keeps the same character, just dialled down (smaller tilt / overlap).
    const overlap = isMobile ? 6 : 13;
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          columnGap: `${colGap}px`,
          rowGap: `${Math.max(0, rowGap - overlap)}px`,
          alignItems: "start",
        }}
      >
        {photos.map((photo, idx) => {
          const tilt = isMobile
            ? ((photo.id * 53) % 5) - 2
            : ((photo.id * 53) % 9) - 4; // ±2deg mobile / ±4deg PC
          const shift = ((idx % 3) - 1) * overlap; // nudge L/M/R to overlap neighbours
          return (
            <div
              key={photo.id}
              className="collage-card"
              style={
                {
                  position: "relative",
                  zIndex: idx + 1,
                  "--collage-shift": `${shift}px`,
                  "--collage-tilt": `${tilt}deg`,
                  background: "#fff",
                  padding: isMobile ? 4 : 5,
                  boxShadow: isMobile
                    ? "0 3px 10px rgba(0,0,0,0.18)"
                    : "0 5px 16px rgba(0,0,0,0.22)",
                } as React.CSSProperties
              }
            >
              {tile(photo, idx, {
                width: "100%",
                justifySelf: "stretch",
                sizes: gridSizes,
              })}
            </div>
          );
        })}
      </div>
    );
  } else {
    // mosaic (default): controlled-random S/M/L with intentional gaps ("抜け感").
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          columnGap: `${colGap}px`,
          rowGap: `${rowGap}px`,
          alignItems: "start",
        }}
      >
        {mosaicCells.map((cell, i) => {
          if (cell.type === "gap")
            return <div key={`gap-${i}`} aria-hidden="true" />;
          const idx = cell.photoIndex;
          const photo = photos[idx];
          const size = (photo.displaySize || "M") as "S" | "M" | "L";
          const col = i % columns;
          // design-spec 2-3: S/M/L の相対関係はモバイルでも維持（L は全幅）。
          const w = size === "L" ? "100%" : tileWidth(size, sizeVariation);
          const justifySelf =
            size === "L" ? "stretch" : ["start", "center", "end"][col % 3];
          return tile(photo, idx, { width: w, justifySelf, sizes: gridSizes });
        })}
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="filter-grid-animated">
        {body}
      </div>
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photos={photos.map((p) => ({
            ...p,
            lqipSrc: p.thumbUrl ?? `${p.url}?w=20&q=20`,
          }))}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
          onRequestMore={onRequestMore}
        />
      )}
    </>
  );
}
