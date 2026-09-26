import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Picture } from "../Picture";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { photoAltText } from "../../../shared/photo-alt";
import { planRows, rowOptionsFor, aspectOf } from "../../lib/photo-rows";
import type { SeriesLink } from "../../lib/series-links";
import { PhotoViewer, usePhotoViewer } from "./viewer";

/** 最初に描く枚数と、読み足す枚数。 */
const FIRST_BATCH = 40;
const STEP = 40;

/**
 * 写真を段に組んで並べる（写真中心のサイトの本体、2026-09-26）。
 *
 * 組み方は `lib/photo-rows.ts`。写真は元の縦横比のまま、切り抜かない。
 * 段の位置と高さは最初から決まっているので、画像が届いても下の写真は動かない。
 * 押すとその写真からビューアが開く。
 */
export function PhotoStream({
  photos,
  photographerName,
  seriesLinkById,
  seriesName,
  label,
}: {
  photos: GalleryPhoto[];
  photographerName: string;
  seriesLinkById?: Record<number, SeriesLink>;
  /** シリーズのページでは、そのシリーズの名前（写真の説明文に使う） */
  seriesName?: string;
  /** 一覧の名前（読み上げ用） */
  label: string;
}) {
  const boxRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState(0);
  // 画面の高さは、幅が変わったときだけ読み直す。スマホはスクロールのたびに
  // アドレスバーで高さが変わり、そのたびに段を組み直すと写真が跳ねる。
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (Math.abs(w - lastWidth.current) < 1) return;
      lastWidth.current = w;
      setViewportHeight(window.innerHeight);
      setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ratios = useMemo(
    () =>
      photos.map((p) => {
        const d = orientedDimensions(p.width, p.height, p.rotationDeg);
        return aspectOf(d.width, d.height);
      }),
    [photos],
  );
  const plan = useMemo(
    () => (width > 0 ? planRows(ratios, rowOptionsFor(width, viewportHeight)) : null),
    [ratios, width, viewportHeight],
  );

  const [count, setCount] = useState(FIRST_BATCH);
  useEffect(() => setCount(FIRST_BATCH), [photos]);
  const rows = useMemo(() => {
    if (!plan) return [];
    const out = [];
    for (const row of plan.rows) {
      if (row.items[0]!.index >= count) break;
      out.push(row);
    }
    return out;
  }, [plan, count]);
  const shownHeight = rows.length
    ? rows[rows.length - 1]!.top + rows[rows.length - 1]!.height
    : 0;
  const more = plan ? rows.length < plan.rows.length : false;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => c + STEP);
      },
      { rootMargin: "1400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, rows.length]);

  // 画像が届いたら静かに現す。届く前の枠は淡い地のまま、位置は動かない。
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const mark = (img: HTMLImageElement) => {
      img.dataset.loaded = "";
    };
    box.querySelectorAll<HTMLImageElement>("img:not([data-loaded])").forEach((img) => {
      if (img.complete) mark(img);
    });
    const onLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) mark(e.target);
    };
    box.addEventListener("load", onLoad, true);
    box.addEventListener("error", onLoad, true);
    return () => {
      box.removeEventListener("load", onLoad, true);
      box.removeEventListener("error", onLoad, true);
    };
  });

  const viewer = usePhotoViewer(photos);
  const eagerUntil = viewportHeight * 1.2;

  return (
    <>
      <ul
        ref={boxRef}
        className="ps-stream"
        aria-label={label}
        style={{ height: shownHeight }}
      >
        {rows.map((row) =>
          row.items.map((item) => {
            const photo = photos[item.index]!;
            return (
              <li
                key={photo.id}
                className="ps-tile"
                style={{ left: item.x, top: row.top, width: item.width, height: row.height }}
              >
                <button
                  type="button"
                  className="ps-tile__button"
                  data-photo-tile={photo.id}
                  onClick={() => viewer.open(item.index)}
                  aria-label={photo.title ? `${photo.title}を大きく見る` : "この写真を大きく見る"}
                >
                  <Picture
                    url={photo.url}
                    thumbUrl={photo.thumbUrl}
                    mediumUrl={photo.mediumUrl}
                    width={photo.width}
                    height={photo.height}
                    rotationDeg={photo.rotationDeg}
                    alt={photoAltText(photo, {
                      photographerName,
                      seriesName:
                        seriesName ?? seriesLinkById?.[photo.seriesId ?? -1]?.name,
                    })}
                    preset="lightbox"
                    sizes={`${Math.ceil(item.width)}px`}
                    fallbackW={1600}
                    fallbackQ={82}
                    className="ps-tile__img"
                    loading={row.top < eagerUntil ? "eager" : "lazy"}
                    fetchPriority={row.top === 0 ? "high" : "auto"}
                    draggable={false}
                  />
                </button>
              </li>
            );
          }),
        )}
      </ul>
      {more && <div ref={sentinelRef} className="ps-sentinel" aria-hidden="true" />}
      <PhotoViewer
        photos={photos}
        viewer={viewer}
        photographerName={photographerName}
        seriesName={seriesName}
        seriesLinkById={seriesLinkById}
      />
    </>
  );
}
