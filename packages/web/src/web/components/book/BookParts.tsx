import { useCallback, useEffect, useRef, useState } from "react";
import { Picture } from "../Picture";
import { Lightbox } from "../Lightbox";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { photoAltText } from "../../../shared/photo-alt";
import { photoSrcFor } from "../../lib/picture";
import { pad2 } from "../../lib/book";
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
}: {
  photo: GalleryPhoto;
  alt: string;
  sizes: string;
  eager?: boolean;
  onOpen?: () => void;
  openLabel: string;
}) {
  const dims = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  const ar = dims.width && dims.height ? dims.width / dims.height : 4 / 5;
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

export type BookPlacement = "recto" | "verso" | "spread";

/**
 * 横の写真は見開きいっぱい、縦の写真は右ページ・左ページを交互に。
 * 写真集の頁をめくるときの「間」を、写真の形から作る。
 */
export function placementFor(photo: GalleryPhoto, index: number): BookPlacement {
  const dims = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  if (dims.width && dims.height && dims.width > dims.height * 1.05) return "spread";
  return index % 2 === 0 ? "recto" : "verso";
}

/**
 * 写真1枚の頁。キャプションは写真の反対側の頁の下に置く（見開きの写真は
 * 写真の下）。**写真の上には何も重ねない。**
 */
export function BookPhotoPage({
  photo,
  index,
  total,
  label,
  id,
  placement,
  eager,
  onOpen,
  photographerName,
  language,
}: {
  photo: GalleryPhoto;
  index: number;
  total: number;
  label: string;
  id?: string;
  placement: BookPlacement;
  eager?: boolean;
  onOpen?: () => void;
  photographerName?: string;
  language: "ja" | "en";
}) {
  const alt = photoAltText(photo, { photographerName, seriesName: label });
  const num = `${pad2(index + 1)} / ${pad2(total)}`;
  const title = photo.title?.trim();
  return (
    <section
      id={id}
      className="book-page"
      data-placement={placement}
      data-book-page=""
      data-book-label={label}
      data-book-num={num}
      aria-label={`${label} ${num}`}
    >
      <figure className="book-page__figure">
        <BookPhoto
          photo={photo}
          alt={alt}
          eager={eager}
          sizes={
            placement === "spread"
              ? "(min-width: 768px) calc(100vw - 16rem), 100vw"
              : "(min-width: 768px) calc((100vw - 13rem) / 2), 100vw"
          }
          onOpen={onOpen}
          openLabel={
            language === "ja" ? `${alt}を拡大して見る` : `Open ${alt} larger`
          }
        />
      </figure>
      <p className="book-page__folio font-en">
        <span className="book-page__num">{pad2(index + 1)}</span>
        <span className="book-page__of">/ {pad2(total)}</span>
        {title && <span className="book-page__title font-ja">{title}</span>}
      </p>
    </section>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * いま開いている頁を数え、左右の矢印で頁を送る。
 *
 * 上下の矢印・スペース・PageDown はブラウザ本来のスクロールのまま残す。
 * ビューア（dialog）が開いている間と、文字を打っている間は何もしない。
 */
export function useBookPager(deps: unknown[]) {
  const [current, setCurrent] = useState<{ label: string; num: string } | null>(
    null,
  );
  useEffect(() => {
    const pages = Array.from(
      document.querySelectorAll<HTMLElement>("[data-book-page]"),
    );
    if (pages.length === 0 || typeof IntersectionObserver === "undefined") return;
    // 見えている頁の割合を覚えておき、いちばん多く見えている頁を札に出す。
    // 頁のない所（奥付・フッター）まで来たら札を消す。IntersectionObserver は
    // 変わった頁しか知らせないので、最後の知らせだけで決めると古い頁が残る。
    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) ratios.set(e.target, e.intersectionRatio);
          else ratios.delete(e.target);
        }
        let best: HTMLElement | null = null;
        let bestRatio = 0;
        ratios.forEach((ratio, el) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = el as HTMLElement;
          }
        });
        const el = best as HTMLElement | null;
        setCurrent(
          el
            ? { label: el.dataset.bookLabel ?? "", num: el.dataset.bookNum ?? "" }
            : null,
        );
      },
      { threshold: [0, 0.35, 0.6] },
    );
    pages.forEach((p) => io.observe(p));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const pages = Array.from(
        document.querySelectorAll<HTMLElement>("[data-book-page], [data-book-stop]"),
      );
      if (pages.length === 0) return;
      const edge = window.innerHeight * 0.3;
      const idx = pages.findIndex((p) => p.getBoundingClientRect().bottom > edge);
      const at = idx < 0 ? pages.length - 1 : idx;
      const target =
        event.key === "ArrowRight" ? pages[Math.min(at + 1, pages.length - 1)] : pages[Math.max(at - 1, 0)];
      if (!target) return;
      event.preventDefault();
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return current;
}

/** PCでは左の余白の下、スマホでは右下の小さな札。 */
export function BookCounter({
  current,
}: {
  current: { label: string; num: string } | null;
}) {
  if (!current) return null;
  return (
    <p className="book-counter font-en" aria-hidden="true">
      <span className="book-counter__label">{current.label}</span>
      <span className="book-counter__num">{current.num}</span>
    </p>
  );
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
  // 閉じたら、最後に見ていた写真の頁へ戻る。
  useEffect(() => {
    if (index !== null) return;
    const id = lastIdRef.current;
    if (id === null) return;
    lastIdRef.current = null;
    const tile = document.querySelector<HTMLElement>(`[data-photo-tile="${id}"]`);
    tile?.focus({ preventScroll: true });
    tile?.closest("[data-book-page]")?.scrollIntoView({ block: "start" });
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
