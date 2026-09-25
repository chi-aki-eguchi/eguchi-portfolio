import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Picture } from "../Picture";
import { Lightbox } from "../Lightbox";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { objectPositionFromFocal, photoSrcFor } from "../../lib/picture";
import type { SeriesLink } from "../../lib/series-links";

/**
 * 写真集の1ページに置く写真。
 *
 * 枠の縦横比を最初の描画から決めておく（読み込み後に測り直すと版がずれる）。
 * 大きさは「画面の高さの 84% まで・版面の幅まで」のうち小さいほう。
 * 切り抜かない——写真集は写真の全体を見せる。
 */
export function BookPhoto({
  photo,
  alt,
  sizes,
  eager,
  onOpen,
  openLabel,
  coverRatio,
}: {
  photo: GalleryPhoto;
  alt: string;
  sizes: string;
  eager?: boolean;
  onOpen?: () => void;
  openLabel: string;
  /**
   * 枠の縦横比を決めて、写真の「見せる中心」を軸に切り抜く（作品の表紙）。
   * 無ければ写真そのままの比で、切り抜かない。
   */
  coverRatio?: number;
}) {
  const dims = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  const ar = coverRatio ?? (dims.width && dims.height ? dims.width / dims.height : 4 / 5);
  const style = { "--book-ar": String(ar) } as React.CSSProperties;
  const picture = (
    <Picture
      url={photo.url}
      // 頁の写真は画面の半分〜全幅で見せる。取り込み時の中サイズ（幅616px）
      // では高精細の画面で粗くなるので、ビューアと同じ段階の幅から選ばせる。
      width={photo.width}
      height={photo.height}
      rotationDeg={photo.rotationDeg}
      alt={alt}
      preset="lightbox"
      sizes={sizes}
      fallbackW={1600}
      fallbackQ={82}
      className="book-photo__img"
      style={
        coverRatio
          ? { objectFit: "cover", objectPosition: objectPositionFromFocal(photo.focalX, photo.focalY) }
          : undefined
      }
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
    />
  );
  if (!onOpen) {
    return (
      <div className="book-photo" style={style}>
        {picture}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="book-photo"
      style={style}
      onClick={onOpen}
      aria-label={openLabel}
      data-photo-tile={photo.id}
    >
      {picture}
    </button>
  );
}

/**
 * 頁が画面に入ったら、写真を「現像」する（2026-09-25）。
 *
 * 印画紙に像が出てくるように、少し明るく眠い調子から本来の濃さへ落ち着く。
 * 動くのは濃淡と調子だけで、写真の位置も大きさも変えない（版がずれない）。
 * 1枚につき1度きり。戻ってきても繰り返さない。
 *
 * 画像が読み込み終わってから始める。読み込み前に始めると、空の枠が
 * 濃くなったあとで写真が「パッ」と出てしまう。
 *
 * 待たせる印 `data-develop="wait"` は、このフックが見張ると決めた写真にだけ
 * 付ける。見張っていない写真（あとから増えた頁など）は印が無いので、
 * いつもどおりそのまま見える——隠れたまま残ることはない。
 */
export function useBookDevelop(deps: unknown[]) {
  useLayoutEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const photos = Array.from(
      document.querySelectorAll<HTMLElement>(".book .book-photo:not([data-develop])"),
    );
    if (photos.length === 0) return;
    const develop = (el: HTMLElement) => {
      const img = el.querySelector("img");
      const show = () => {
        // 1フレーム置いてから外す。同じフレームで付け外しすると、
        // transition が始まらずに即座に見えてしまう。
        requestAnimationFrame(() => {
          el.dataset.develop = "done";
        });
      };
      if (!img || (img.complete && img.naturalWidth > 0)) return show();
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", show, { once: true });
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          develop(entry.target as HTMLElement);
        }
      },
      // 少し画面に入ってから。縁にかかった瞬間だと、見る前に終わっている。
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of photos) {
      el.dataset.develop = "wait";
      io.observe(el);
    }
    return () => {
      io.disconnect();
      // 見張りをやめる写真は、隠したまま残さない。印を外しておけば、次に
      // 見張るとき（頁が増えた・開発時の StrictMode の付け直し）に拾い直せる。
      for (const el of photos) {
        if (el.dataset.develop === "wait") delete el.dataset.develop;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 頁の写真を押したら、今までと同じビューア（撮影情報・前後送り付き）で開く。
 */
export function useBookViewer(photos: GalleryPhoto[]) {
  const [index, setIndex] = useState<number | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const open = useCallback((i: number) => {
    lastIdRef.current = photos[i]?.id ?? null;
    setIndex(i);
  }, [photos]);
  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(() => {
    setIndex((i) => {
      if (i === null) return null;
      const ni = (i - 1 + photos.length) % photos.length;
      lastIdRef.current = photos[ni]?.id ?? null;
      return ni;
    });
  }, [photos]);
  const next = useCallback(() => {
    setIndex((i) => {
      if (i === null) return null;
      const ni = (i + 1) % photos.length;
      lastIdRef.current = photos[ni]?.id ?? null;
      return ni;
    });
  }, [photos]);
  // 閉じたら、最後に見ていた写真へ焦点を戻す（位置はビューアが合わせる）。
  useEffect(() => {
    if (index !== null) return;
    const id = lastIdRef.current;
    if (id === null) return;
    lastIdRef.current = null;
    const tile = document.querySelector<HTMLElement>(`[data-photo-tile="${id}"]`);
    tile?.focus({ preventScroll: true });
  }, [index]);
  return { index, open, close, prev, next };
}

export function BookViewer({
  photos,
  viewer,
  photographerName,
  seriesName,
  seriesLinkById,
}: {
  photos: GalleryPhoto[];
  viewer: ReturnType<typeof useBookViewer>;
  photographerName?: string;
  seriesName?: string;
  seriesLinkById?: Record<number, SeriesLink>;
}) {
  if (viewer.index === null || !photos[viewer.index]) return null;
  return (
    <Lightbox
      photos={photos.map((p) => ({
        ...p,
        lqipSrc: p.thumbUrl ?? photoSrcFor(p, 20, 20),
      }))}
      index={viewer.index}
      onClose={viewer.close}
      onPrev={viewer.prev}
      onNext={viewer.next}
      totalCount={photos.length}
      photographerName={photographerName}
      seriesName={seriesName}
      seriesLinkById={seriesLinkById}
    />
  );
}
