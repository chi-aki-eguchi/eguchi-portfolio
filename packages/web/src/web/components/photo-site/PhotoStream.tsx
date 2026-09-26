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
  after,
  lead,
  maxRows,
}: {
  photos: GalleryPhoto[];
  photographerName: string;
  seriesLinkById?: Record<number, SeriesLink>;
  /** シリーズのページでは、そのシリーズの名前（写真の説明文に使う） */
  seriesName?: string;
  /** 一覧の名前（読み上げ用） */
  label: string;
  /** 写真を全部並べ終えたあとに出すもの（撮影依頼の案内など）。途中では出さない。 */
  after?: React.ReactNode;
  /**
   * 1段目を表紙の段にする（トップ）。画面の高さから reserve（上の帯・名前の分）を
   * 引いた高さに合わせて、先頭から何枚並べるかを決める。
   */
  lead?: { reserve: number };
  /** 段の数の上限（トップを「表紙だけ」にするとき 1）。 */
  maxRows?: number;
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
  const leadReserve = lead?.reserve;
  const plan = useMemo(() => {
    if (!(width > 0)) return null;
    const opts = rowOptionsFor(width, viewportHeight);
    if (leadReserve === undefined) return planRows(ratios, opts);
    const full = planRows(ratios, {
      ...opts,
      lead: {
        height: Math.max(width < 640 ? 260 : 320, viewportHeight - leadReserve),
        maxCount: width < 640 ? 2 : 4,
      },
    });
    if (!maxRows || full.rows.length <= maxRows) return full;
    const rows = full.rows.slice(0, maxRows);
    const last = rows[rows.length - 1]!;
    return { rows, height: last.top + last.height };
  }, [ratios, width, viewportHeight, leadReserve, maxRows]);
  // 段の数を絞ったときは、並んだ写真だけをビューアで送る。
  const shownPhotos = useMemo(() => {
    if (!plan || !maxRows) return photos;
    const lastRow = plan.rows[plan.rows.length - 1];
    const end = lastRow ? lastRow.items[lastRow.items.length - 1]!.index + 1 : 0;
    return photos.slice(0, end);
  }, [plan, maxRows, photos]);

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

  const viewer = usePhotoViewer(shownPhotos);
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
      {!more && plan && after}
      <PhotoViewer
        photos={shownPhotos}
        viewer={viewer}
        photographerName={photographerName}
        seriesName={seriesName}
        seriesLinkById={seriesLinkById}
      />
    </>
  );
}
