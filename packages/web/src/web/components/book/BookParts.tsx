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
 * 写真1枚の頁。**文字を置かない**（題・枚数・頁番号は扉の頁だけ、2026-09-23
 * オーナー指示）。写真は画面の高さいっぱい近くまで、横の写真は版面の幅
 * いっぱいまで。まわりの余白は均等な縁として残す。頁番号は読み上げ用の
 * 名前（aria-label）にだけ持つ。
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
  return (
    <section
      id={id}
      className="book-page"
      data-placement={placement}
      data-book-page=""
      data-book-kind="photo"
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
              ? "100vw"
              : "(min-width: 768px) 70vh, 100vw"
          }
          onOpen={onOpen}
          openLabel={
            language === "ja" ? `${alt}を拡大して見る` : `Open ${alt} larger`
          }
        />
      </figure>
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
 * いま開いている頁を見て、写真の頁では左のメニューを引っ込める
 * （`body[data-book-immersive]`、book.css）。上へ戻る方向に動かしたとき・
 * 左の縁に指を乗せたとき・メニューへ焦点が来たときは出す。
 *
 * 左右の矢印で頁を送る。上下の矢印・スペース・PageDown はブラウザ本来の
 * スクロールのまま残す。ビューア（dialog）が開いている間と、文字を打って
 * いる間は何もしない。
 */
export function useBookPager(deps: unknown[]) {
  const [onPhoto, setOnPhoto] = useState(false);
  const [goingUp, setGoingUp] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY - 12) setGoingUp(true);
      else if (y > lastY + 12) setGoingUp(false);
      if (Math.abs(y - lastY) > 12) lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const immersive = onPhoto && !goingUp;
  useEffect(() => {
    const body = document.body;
    if (immersive) body.dataset.bookImmersive = "";
    else delete body.dataset.bookImmersive;
  }, [immersive]);
  useEffect(
    () => () => {
      delete document.body.dataset.bookImmersive;
    },
    [],
  );
  // 画面の縦の真ん中にある頁が写真の頁かどうかで決める。スマホでは写真の
  // 頁が短く一度に何枚も見えるので、「いちばん多く見えている頁」では決まらない。
  useEffect(() => {
    const check = () => {
      const mid = window.innerHeight / 2;
      const pages = document.querySelectorAll<HTMLElement>("[data-book-page]");
      let kind: string | undefined;
      for (const el of pages) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          kind = el.dataset.bookKind;
          break;
        }
      }
      setOnPhoto(kind === "photo");
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
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
