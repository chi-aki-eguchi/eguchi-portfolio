import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbox } from "../Lightbox";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoSrcFor } from "../../lib/picture";
import type { SeriesLink } from "../../lib/series-links";

/**
 * 写真を押したら、いつものビューア（撮影情報・前後送り付き）で開く。
 * 閉じたら、最後に見ていた写真へ焦点を戻す（位置はビューアが合わせる）。
 */
export function usePhotoViewer(photos: GalleryPhoto[]) {
  const [index, setIndex] = useState<number | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const open = useCallback(
    (i: number) => {
      lastIdRef.current = photos[i]?.id ?? null;
      setIndex(i);
    },
    [photos],
  );
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((i) => {
        if (i === null || photos.length === 0) return null;
        const ni = (i + delta + photos.length) % photos.length;
        lastIdRef.current = photos[ni]?.id ?? null;
        return ni;
      }),
    [photos],
  );
  const prev = useCallback(() => step(-1), [step]);
  const next = useCallback(() => step(1), [step]);
  useEffect(() => {
    if (index !== null) return;
    const id = lastIdRef.current;
    if (id === null) return;
    lastIdRef.current = null;
    document.querySelector<HTMLElement>(`[data-photo-tile="${id}"]`)?.focus({ preventScroll: true });
  }, [index]);
  return { index, open, close, prev, next };
}

export type PhotoViewerState = ReturnType<typeof usePhotoViewer>;

export function PhotoViewer({
  photos,
  viewer,
  photographerName,
  seriesName,
  seriesLinkById,
}: {
  photos: GalleryPhoto[];
  viewer: PhotoViewerState;
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
