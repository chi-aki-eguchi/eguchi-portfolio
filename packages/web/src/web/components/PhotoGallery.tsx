import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  useLayoutEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { buildGalleryLayout, tileWidth } from "../lib/gallery-layout";
import { computeJustifiedRows } from "../lib/justified-layout";
import { num, clamp } from "../lib/utils";
import {
  clampSetting,
  clampSettingRounded,
} from "../../shared/setting-ranges";
import {
  GALLERY_MIN_TILE_DESKTOP,
  GALLERY_MIN_TILE_MOBILE,
} from "../../shared/gallery-metrics";
import { Lightbox, FIT_SIZES } from "./Lightbox";
import {
  objectPositionFromFocal,
  orientedAspectRatio,
  orientedDimensions,
  photoSrcFor,
  photoSrcSetFor,
  srcFor,
  srcSetFor,
} from "../lib/picture";
import { photoAltText } from "../lib/photo-alt";

const _preloaded = new Set<string>();
function preloadForLightbox(
  photo: Pick<GalleryPhoto, "url" | "mediumUrl" | "rotationDeg">,
) {
  const key = photo.mediumUrl || `${photo.url}:${photo.rotationDeg ?? 0}`;
  if (_preloaded.has(key)) return;
  _preloaded.add(key);
  const img = new Image();
  if (photo.mediumUrl) {
    img.src = photo.mediumUrl;
  } else {
    img.sizes = FIT_SIZES;
    img.srcset = photoSrcSetFor(photo, "lightbox", "webp");
    img.src = photoSrcFor(photo, 1920, 85, "webp");
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
    preloadForLightbox(photo);
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
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  description?: string | null;
  category?: string | null;
  seriesId?: number | null;
};

// N1/N4: the selectable grid layouts. Unknown / unset values fall back to mosaic.
// 12 types (owner-approved 2026-07-09 expansion to 11, justified added
// 2026-07-12 by owner request — see task.md Handoff).
export type GalleryLayoutType =
  | "mosaic"
  | "grid"
  | "scroll"
  | "stagger"
  | "editorial"
  | "collage"
  | "clean-grid"
  | "portrait-grid"
  | "landscape-grid"
  | "masonry"
  | "large-format"
  | "justified";
const KNOWN_LAYOUTS: GalleryLayoutType[] = [
  "mosaic",
  "grid",
  "scroll",
  "stagger",
  "editorial",
  "collage",
  "clean-grid",
  "portrait-grid",
  "landscape-grid",
  "masonry",
  "large-format",
  "justified",
];

/**
 * How wide the grid must be for the requested column count to actually happen,
 * or 0 to stay at the page width.
 *
 * The count is `floor(width / minTile)` capped by the admin's 最大列数, so it
 * could never exceed what the page's fixed 1024px shell had room for: at the
 * default photo size only 4 tiles fit, and asking for 5–8 changed nothing —
 * the slider read as broken (measured 2026-08-07 on the live gallery: 8
 * requested, 928px shell, 4 rendered). So the frame grows to fit the request
 * instead of the request being silently clipped to the frame.
 *
 * Never narrows: a site that never set the key, or one whose request already
 * fits, keeps the exact page width it always had.
 */
export function galleryFrameWidth({
  requestedColumns,
  minTile,
  natural,
  available,
  isMobile,
}: {
  requestedColumns: number;
  minTile: number;
  /** Width the page shell gives the grid. */
  natural: number;
  /** Widest the grid can grow while staying inside the viewport. */
  available: number;
  isMobile: boolean;
}): number {
  // Phones are already full-bleed; widening there would only add sideways scroll.
  if (isMobile || natural <= 0 || !Number.isFinite(requestedColumns)) return 0;
  // Both column keys share one range, so either name gives the same bounds.
  const columns = clampSettingRounded("galleryColumns", requestedColumns);
  // +1px so floor(width / minTile) can't land one short on a rounding edge.
  const needed = Math.round(columns * minTile) + 1;
  const width = Math.min(needed, available);
  return width > natural ? Math.round(width) : 0;
}

const LqipImage = memo(function LqipImage({
  url,
  thumbUrl,
  upgradeUrl,
  alt,
  sizes,
  isNearViewport,
  isFirst,
  width,
  height,
  rotationDeg,
  style,
}: {
  url: string;
  thumbUrl?: string | null;
  upgradeUrl?: string | null;
  alt: string;
  sizes: string;
  isNearViewport: boolean;
  isFirst: boolean;
  width: number | null | undefined;
  height: number | null | undefined;
  rotationDeg?: number | null;
  style?: React.CSSProperties;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const swappedRef = useRef(false);
  const hasThumbUpgrade = Boolean(
    thumbUrl && upgradeUrl && upgradeUrl !== thumbUrl,
  );

  useLayoutEffect(() => {
    setLoaded(false);
    swappedRef.current = false;
  }, [url, thumbUrl, upgradeUrl]);

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

  const handleLoadedImage = useCallback(
    (el: HTMLImageElement) => {
      if (thumbUrl && !hasThumbUpgrade) {
        swappedRef.current = true;
        setLoaded(true);
        return;
      }
      swapToGridImage(el, hasThumbUpgrade);
    },
    [hasThumbUpgrade, swapToGridImage, thumbUrl],
  );

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) =>
      handleLoadedImage(e.currentTarget),
    [handleLoadedImage],
  );

  useLayoutEffect(() => {
    const el = imgRef.current;
    if (!el || !el.complete || el.naturalWidth <= 0) return;
    if (!thumbUrl && !isNearViewport) return;
    if (thumbUrl && hasThumbUpgrade && !isNearViewport) {
      setLoaded(true);
      return;
    }
    handleLoadedImage(el);
  }, [handleLoadedImage, hasThumbUpgrade, isNearViewport, thumbUrl]);

  // Use the pre-generated WebP as the instant first paint, then silently upgrade
  // only for layouts that genuinely render photos large. Normal gallery grids
  // keep the generated thumbnail as final output to avoid flooding the image
  // proxy with on-the-fly variants during long scrolls.
  if (thumbUrl) {
    const hasUpgrade = Boolean(upgradeUrl && upgradeUrl !== thumbUrl);
    return (
      <img
        ref={imgRef}
        src={thumbUrl}
        data-src={hasUpgrade ? (upgradeUrl ?? undefined) : undefined}
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
  }

  return (
    <img
      ref={imgRef}
      src={
        isNearViewport
          ? srcFor(url, 600, 84, undefined, rotationDeg)
          : srcFor(url, 20, 20, undefined, rotationDeg)
      }
      data-src={
        isNearViewport
          ? undefined
          : srcFor(url, 600, 84, undefined, rotationDeg)
      }
      srcSet={
        isNearViewport
          ? srcSetFor(url, "grid", undefined, rotationDeg)
          : undefined
      }
      data-srcset={
        isNearViewport
          ? undefined
          : srcSetFor(url, "grid", undefined, rotationDeg)
      }
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
  seriesName,
  seriesNameById,
  seriesSlugById,
  categoryLabelBySlug,
}: {
  photos: GalleryPhoto[];
  layoutType?: string;
  variant?: "top" | "gallery";
  onRequestMore?: () => void;
  // Used when every photo in this grid belongs to one known series (e.g. a
  // series detail page). `seriesNameById` covers the mixed case (e.g. the
  // general gallery grid, where photos may belong to different series).
  seriesName?: string;
  seriesNameById?: Record<number, string>;
  seriesSlugById?: Record<number, string>;
  categoryLabelBySlug?: Record<string, string>;
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
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photographerName = settings?.siteName || settings?.siteNameEn;

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
  // The frame the count is measured against grows to fit the requested columns
  // (see frameW below), so the maximum is reachable instead of being silently
  // capped by the page shell.
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
  // What the surrounding page gives us: the width it hands the grid, and how
  // much room there is to grow beyond it. Both read from the *parent*, because
  // the frame below sets a width on our own element and deciding from our own
  // width would feed back into itself. Measured directly rather than through
  // ResizeObserver: the frame must be decided on the first layout pass, and an
  // observer's initial callback is not guaranteed to have arrived by then.
  const [room, setRoom] = useState({ natural: 0, available: 0 });
  useLayoutEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const cs = window.getComputedStyle(parent);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const natural =
        parent.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
      if (natural <= 0) return;
      // Grow symmetrically about the parent's centre, so the shorter side is
      // the limit. The page can be off-centre in the viewport (the site's
      // fixed sidebar pushes it right), which is why this cannot be a plain
      // 100vw calc — that would overflow past the right edge.
      const centre = parent.getBoundingClientRect().left + padL + natural / 2;
      const viewport = document.documentElement.clientWidth; // excludes scrollbar
      const available = 2 * Math.min(centre, viewport - centre) - 32;
      setRoom({ natural, available });
    };
    measure();
    // Re-measure on viewport changes, and on anything that resizes the shell
    // without one (sidebar collapse, zoom, a late web font).
    window.addEventListener("resize", measure);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    ro?.observe(parent);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  const isTop = variant === "top";
  const pick = (topKey: string, galleryKey: string, fallback: number) => {
    const s = settings as Record<string, string> | undefined;
    const topVal = isTop ? num(s?.[topKey], NaN) : NaN;
    return Number.isFinite(topVal) && (s?.[topKey] ?? "") !== ""
      ? topVal
      : num(s?.[galleryKey], fallback);
  };

  // Bounds come from SETTING_RANGES so they cannot drift from what the admin
  // offers — a slider whose top third does nothing reads as a broken control.
  const gapScale = clampSetting(
    isTop ? "topWorksGapScale" : "galleryGapScale",
    pick("topWorksGapScale", "galleryGapScale", 1),
  );
  const emptyRate = clampSetting(
    "galleryEmptyRate",
    num(settings?.galleryEmptyRate, 0.1),
  );
  const sizeVariation = clampSetting(
    "gallerySizeVariation",
    num(settings?.gallerySizeVariation, 0.5),
  );
  const sizeScale = clampSetting(
    isTop ? "topWorksSizeScale" : "gallerySizeScale",
    pick("topWorksSizeScale", "gallerySizeScale", 1),
  );
  // Larger sizeScale → wider minimum tile → fewer columns → bigger photos.
  // 数値は `shared/gallery-metrics.ts` から取る。管理画面が「なぜ列数が
  // 伸びないか」を説明するのに同じ値を読むため、ここに書き戻さない。
  const minTile =
    (isMobile ? GALLERY_MIN_TILE_MOBILE : GALLERY_MIN_TILE_DESKTOP) * sizeScale;
  // Each layout passes the column count it used to hardcode as its fallback, so
  // an untouched site keeps the exact look it had while the admin's 列数 slider
  // now reaches every layout — previously masonry / clean-grid / large-format
  // ignored it entirely and the control did nothing on those layouts.
  const columnsFor = (layoutDefaultMax: number) => {
    const maxColumns = clampSettingRounded(
      isTop ? "topWorksColumns" : "galleryColumns",
      pick("topWorksColumns", "galleryColumns", layoutDefaultMax),
    );
    return clamp(Math.floor(containerW / minTile) || 1, 1, maxColumns);
  };
  const columns = columnsFor(3);
  const requestedColumns = pick("topWorksColumns", "galleryColumns", NaN);
  const frameW = galleryFrameWidth({
    requestedColumns,
    minTile,
    isMobile,
    ...room,
  });
  const frameStyle = frameW
    ? ({
        // Wider than the parent, still centred on it: the negative margin is
        // what lets the grid step outside the page shell.
        width: `${frameW}px`,
        marginInline: `calc((100% - ${frameW}px) / 2)`,
      } as React.CSSProperties)
    : undefined;
  // Applying the frame changes our own width, and the column count is derived
  // from that width — so read it back once the new frame has been laid out.
  // Without this the grid would widen but keep the old, narrower column count.
  useLayoutEffect(() => {
    const w = containerRef.current?.getBoundingClientRect().width;
    if (w) setContainerW(w);
  }, [frameW]);
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
  // 閉じたあとフォーカスをタイルへ戻す（backlog B-20 / 2026-08-05 実測）。
  // ネイティブ <dialog> は showModal 前の要素へ戻す仕様だが、実測では body に
  // 落ちていた。閉じている間にグリッドが描き直され、元のボタン要素が別物に
  // 入れ替わっているため。id で引き直して当て直す。
  //
  // 戻す先は「開いたタイル」ではなく「最後に見ていた写真のタイル」。矢印で
  // 送ったあとに閉じたとき、いま見ていた写真の場所から続けられる。
  // preventScroll を付けるのは、ビューアが閉じ際にスクロール位置を戻して
  // いるため。付けないとフォーカスがそれを引っぱって別の場所へ飛ぶ。
  const restoreFocusIdRef = useRef<number | null>(null);
  const closeLightbox = useCallback(() => {
    restoreFocusIdRef.current = openPhotoIdRef.current;
    setLightboxIndex(null);
  }, []);
  useEffect(() => {
    if (lightboxIndex !== null) return;
    const id = restoreFocusIdRef.current;
    if (id === null) return;
    restoreFocusIdRef.current = null;
    const tile = document.querySelector<HTMLButtonElement>(
      `[data-photo-tile="${id}"]`,
    );
    tile?.focus({ preventScroll: true });
  }, [lightboxIndex]);
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
      preferMediumGrid?: boolean;
      cardAspectRatio?: string;
    },
  ) => {
    const ratio = orientedAspectRatio(
      photo.width,
      photo.height,
      photo.rotationDeg,
    );
    const dims = orientedDimensions(
      photo.width,
      photo.height,
      photo.rotationDeg,
    );
    const imgStyle = {
      ...(opts.imgStyle ??
        (ratio ? { aspectRatio: ratio, width: "100%", height: "auto" } : {})),
      objectPosition: objectPositionFromFocal(photo.focalX, photo.focalY),
    };
    const isNearViewport = idx < 8;
    const tileSeriesName =
      seriesName ??
      (photo.seriesId != null ? seriesNameById?.[photo.seriesId] : undefined);
    const categoryLabel = photo.category
      ? categoryLabelBySlug?.[photo.category]
      : undefined;
    const alt = photoAltText(photo, {
      photographerName,
      seriesName: tileSeriesName,
      categoryLabel,
    });
    return (
      <button
        key={photo.id}
        type="button"
        aria-label={alt}
        // 閉じたあとフォーカスを戻すときの目印（B-20）。key と違い DOM に残る。
        data-photo-tile={photo.id}
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
        onMouseEnter={() => preloadForLightbox(photo)}
        onPointerDown={() => preloadNearbyLightboxPhotos(photos, idx)}
        onTouchStart={() => preloadForLightbox(photo)}
      >
        <div
          className={`photo-card fade-in-item${opts.cardClassName ? ` ${opts.cardClassName}` : ""}`}
          style={
            {
              "--stagger-delay": `${Math.min((opts.staggerIdx ?? idx) * 0.05, 0.4)}s`,
              ...(opts.cardAspectRatio
                ? { aspectRatio: opts.cardAspectRatio }
                : ratio
                  ? { aspectRatio: ratio }
                  : {}),
            } as React.CSSProperties
          }
        >
          <picture>
            {isNearViewport && !photo.thumbUrl && (
              <>
                <source
                  type="image/avif"
                  srcSet={photoSrcSetFor(photo, "grid", "avif")}
                  sizes={opts.sizes}
                />
                <source
                  type="image/webp"
                  srcSet={photoSrcSetFor(photo, "grid", "webp")}
                  sizes={opts.sizes}
                />
              </>
            )}
            <LqipImage
              url={photo.url}
              thumbUrl={photo.thumbUrl}
              upgradeUrl={opts.preferMediumGrid ? photo.mediumUrl : undefined}
              alt={alt}
              sizes={opts.sizes}
              isNearViewport={isNearViewport}
              isFirst={idx === 0}
              height={dims.height}
              width={dims.width}
              rotationDeg={photo.rotationDeg}
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
    // Instagram-style square grid. The outer .photo-card box must be forced to
    // 1/1 too — otherwise it inherits the source photo's own aspect ratio and
    // squareCoverStyle's objectFit:cover just crops the image inside a
    // non-square box instead of producing a square tile.
    const cols = columnsFor(4);
    const tightGap = Math.round(2 * gapScale);
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: tightGap,
          padding: tightGap,
          alignItems: "start",
        }}
      >
        {photos.map((photo, idx) =>
          tile(photo, idx, {
            width: "100%",
            justifySelf: "stretch",
            sizes: `${Math.round(100 / cols)}vw`,
            cardClassName: quietCardClass,
            imgStyle: squareCoverStyle,
            showHoverCaption: false,
            cardAspectRatio: "1 / 1",
          }),
        )}
      </div>
    );
  } else if (mode === "portrait-grid" || mode === "landscape-grid") {
    // Aligned grid with a fixed crop ratio (owner-approved 2026-07-09
    // expansion): every cell — outer box and image alike — uses the same
    // ratio regardless of the source photo's own orientation. object-fit:cover
    // + focalX/focalY keep the subject framed; rotationDeg is already baked
    // into the served image URL (see srcFor/srcSetFor above), same as every
    // other layout.
    const ratio = mode === "portrait-grid" ? "4 / 5" : "3 / 2";
    const coverStyle: React.CSSProperties = {
      aspectRatio: ratio,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
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
            imgStyle: coverStyle,
            cardAspectRatio: ratio,
          }),
        )}
      </div>
    );
  } else if (mode === "masonry") {
    const cols = columnsFor(3);
    const masonryGap = Math.round(8 * gapScale);
    const columns: { photo: (typeof photos)[number]; idx: number }[][] =
      Array.from({ length: cols }, () => []);
    for (let i = 0; i < photos.length; i++) {
      columns[i % cols].push({ photo: photos[i], idx: i });
    }
    body = (
      <div style={{ display: "flex", gap: masonryGap }}>
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: masonryGap,
              minWidth: 0,
            }}
          >
            {col.map(({ photo, idx }) =>
              tile(photo, idx, {
                width: "100%",
                justifySelf: "stretch",
                sizes: `${Math.round(100 / cols)}vw`,
                cardClassName: quietCardClass,
                staggerIdx: idx,
              }),
            )}
          </div>
        ))}
      </div>
    );
  } else if (mode === "justified") {
    // Justified 行組み (owner-approved 12th layout, 2026-07-12): photos flow
    // strictly in sortOrder 左→右・上→下, keep their natural rotation-aware
    // ratio uncropped, and every packed row is flush. S/M/L weights the target
    // row height — the math lives in lib/justified-layout.ts (unit-tested).
    const jGap = Math.round((isMobile ? 6 : 10) * gapScale);
    const jRows = computeJustifiedRows(photos, {
      containerWidth: containerW,
      gap: jGap,
      baseRowHeight: (isMobile ? 200 : 250) * sizeScale,
    });
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: jGap }}>
        {jRows.map((row) => (
          <div
            key={photos[row.items[0].index].id}
            style={{ display: "flex", gap: jGap, alignItems: "flex-start" }}
          >
            {row.items.map((it) => {
              const photo = photos[it.index];
              const ratio = String(it.ratio);
              const pct = Math.max(
                10,
                Math.round((it.width / containerW) * 100),
              );
              return tile(photo, it.index, {
                width: `${it.width}px`,
                justifySelf: "start",
                sizes: `${pct}vw`,
                cardClassName: quietCardClass,
                // The layout ratio equals the natural oriented ratio except for
                // photos with missing dimensions (3:2 fallback) — cover keeps
                // those flush in the row instead of breaking its height.
                cardAspectRatio: ratio,
                imgStyle: {
                  aspectRatio: ratio,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              });
            })}
          </div>
        ))}
      </div>
    );
  } else if (mode === "large-format") {
    // Layout expansion Phase 1: exhibition-like large images with quiet metadata.
    const cols = columnsFor(2);
    body = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          columnGap: Math.round(20 * gapScale),
          rowGap: Math.round((isMobile ? 34 : 46) * gapScale),
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
                sizes: `${Math.round(100 / cols)}vw`,
                cardClassName: quietCardClass,
                showHoverCaption: false,
                preferMediumGrid: true,
              })}
              {(photo.title || sub) && (
                <figcaption style={{ marginTop: 9 }}>
                  {photo.title && (
                    <p
                      className="font-en"
                      style={{
                        margin: 0,
                        fontSize: "var(--text-note)",
                        letterSpacing: "0.04em",
                        lineHeight: 1.45,
                        color: "var(--foreground)",
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
                        fontSize: "var(--text-caption)",
                        letterSpacing: "0.06em",
                        lineHeight: 1.45,
                        color: "var(--text-quiet)",
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
                preferMediumGrid: true,
              })}
              {(photo.title || info) && (
                <figcaption style={{ marginTop: 14, textAlign: "center" }}>
                  {photo.title && (
                    <p
                      className="font-en"
                      style={{
                        fontSize: "var(--text-meta)",
                        letterSpacing: "0.04em",
                        color: "var(--text-quiet)",
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
                        color: "var(--text-quiet)",
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
              preferMediumGrid: true,
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
                  preferMediumGrid: true,
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
                  preferMediumGrid: true,
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
                  preferMediumGrid: true,
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
      <div
        ref={containerRef}
        className="filter-grid-animated"
        style={frameStyle}
      >
        {body}
      </div>
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photos={photos.map((p) => ({
            ...p,
            lqipSrc: p.thumbUrl ?? photoSrcFor(p, 20, 20),
          }))}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
          onRequestMore={onRequestMore}
          photographerName={photographerName}
          seriesName={seriesName}
          seriesNameById={seriesNameById}
          seriesSlugById={seriesSlugById}
          categoryLabelBySlug={categoryLabelBySlug}
        />
      )}
    </>
  );
}
