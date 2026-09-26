import { useEffect, useRef, useState } from "react";
import { Picture } from "../Picture";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { photoAltText } from "../../../shared/photo-alt";
import { aspectOf } from "../../lib/photo-rows";
import type { SeriesLink } from "../../lib/series-links";
import { Link } from "wouter";

/**
 * 名前の字間（em）。空・読めない値は表紙の既定 0.14em。管理画面の範囲
 * （-0.06〜0.8em）はそのまま使い、外れた値だけ範囲に収める。
 */
export function trackingOf(value: string | null | undefined): number {
  const n = Number.parseFloat(value ?? "");
  if (!Number.isFinite(n)) return 0.14;
  return Math.min(0.8, Math.max(-0.06, n));
}

/** 表紙の写真の添え書き: シリーズ名・媒体・年（年はデジタルの撮影日だけ。フィルムの日付は複写日）。 */
export function coverCaption(
  photo: Pick<GalleryPhoto, "filmType" | "shotAt" | "seriesId">,
  seriesLinkById?: Record<number, SeriesLink>,
): { series?: SeriesLink; facts: string } {
  const series = photo.seriesId != null ? seriesLinkById?.[photo.seriesId] : undefined;
  const film = photo.filmType === "フィルム";
  const digital = photo.filmType === "デジタル";
  const year = digital ? /^(\d{4})/.exec(photo.shotAt ?? "")?.[1] : undefined;
  const facts = [film ? "Film" : digital ? "Digital" : "", year ?? ""].filter(Boolean).join(", ");
  return { series, facts };
}

/**
 * トップの表紙（2026-09-26 オーナー「TOP は目を引く TOP 感が欲しい」
 * 「どの写真がどこにあっても成り立つ構成」）。
 *
 * 開いた最初の画面を、大きな名前と1枚の写真で組む。**枠は写真に合わせて変えない。**
 * 名前の欄（左、幅は固定）と写真の舞台（右、残り全部）を先に決め、写真は舞台の中に
 * 元の縦横比のまま、右下にそろえて収まる最大の大きさで置く（切り抜かない）。
 * 縦でも横でもパノラマでも、名前と写真の下端がそろう同じ構図になる。
 * 名前は欄の幅に収まる大きさに合わせる（長い名前でも折れて崩れない）。
 * 写真は「トップの最初に並べる」で選んだもの。押すか ← → で次へ（自動では変わらない）。
 * 下へ送ると写真の一覧が続く。
 *
 * 表紙が見えている間は、上の帯の名前を隠す（同じ名前が二重に並ばないように）。
 * 隠すのは濃さだけで、帯の形は変えない。
 */
export function PhotoCover({
  photos,
  name,
  nameEn,
  subtitle,
  total,
  photographerName,
  streamId,
  seriesLinkById,
  nameTracking,
}: {
  photos: GalleryPhoto[];
  name: string;
  nameEn?: string | null;
  subtitle?: string | null;
  total: number;
  photographerName: string;
  /** 「写真を見る」で送る先（写真の一覧の id） */
  streamId: string;
  seriesLinkById?: Record<number, SeriesLink>;
  /** 管理画面「名前の字間」（em、数字だけ）。名前を欄に収める計算にも使う。 */
  nameTracking?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const count = photos.length;
  const photo = photos[Math.min(index, count - 1)];
  const coverRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // 手元に残っていた画像は load を待たずに出す。
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [index]);

  useEffect(() => {
    const el = coverRef.current;
    const root = document.documentElement;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio > 0.35) root.dataset.psCover = "";
        else delete root.dataset.psCover;
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete root.dataset.psCover;
    };
  }, []);

  const go = (step: number) => {
    if (count < 2) return;
    setLoaded(false);
    setIndex((i) => (i + step + count) % count);
  };
  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (document.querySelector("dialog[open]")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const r = coverRef.current?.getBoundingClientRect();
      if (!r || r.bottom < window.innerHeight * 0.5) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!photo) return null;
  const d = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  const ratio = aspectOf(d.width, d.height);
  const caption = coverCaption(photo, seriesLinkById);
  const toStream = () =>
    document.getElementById(streamId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });

  return (
    <section ref={coverRef} className="ps-cover" aria-label={name}>
      <div
        className="ps-cover__words"
        style={
          {
            "--chars": String(Math.max(3, [...name].length)),
            "--name-tracking": String(trackingOf(nameTracking)),
          } as React.CSSProperties
        }
      >
        <h1 className="ps-cover__name font-ja">{name}</h1>
        {((nameEn && nameEn !== name) || subtitle) && (
          <p className="ps-cover__en font-en">
            {nameEn !== name && nameEn}
            {nameEn && nameEn !== name && subtitle && <span aria-hidden="true"> — </span>}
            {subtitle && <span className="ps-cover__sub">{subtitle}</span>}
          </p>
        )}
        {(caption.series || caption.facts) && (
          <p className="ps-cover__caption font-en" aria-live="polite">
            {caption.series && (
              <Link to={caption.series.href} className="ps-cover__series">
                {caption.series.name}
              </Link>
            )}
            {caption.series && caption.facts && <span aria-hidden="true"> — </span>}
            {caption.facts}
          </p>
        )}
        <div className="ps-cover__foot">
          <button type="button" className="ps-cover__more font-en" onClick={toStream}>
            Photographs <span className="ps-cover__num">{total}</span>
            <span aria-hidden="true" className="ps-cover__arrow">↓</span>
          </button>
          {count > 1 && (
            <span className="ps-cover__nav font-en">
              <button type="button" onClick={() => go(-1)} aria-label="前の写真">
                ←
              </button>
              <span aria-live="polite">
                {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
              <button type="button" onClick={() => go(1)} aria-label="次の写真">
                →
              </button>
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="ps-cover__photo"
        style={{ "--r": String(ratio) } as React.CSSProperties}
        data-loaded={loaded || undefined}
        onClick={() => (count > 1 ? go(1) : toStream())}
        aria-label={count > 1 ? "表紙の写真を送る" : "写真の一覧へ"}
      >
        <Picture
          key={photo.id}
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          mediumUrl={photo.mediumUrl}
          width={photo.width}
          height={photo.height}
          rotationDeg={photo.rotationDeg}
          alt={photoAltText(photo, { photographerName })}
          preset="lightbox"
          sizes="(min-width: 768px) 70vw, 100vw"
          fallbackW={2000}
          fallbackQ={85}
          className="ps-cover__img"
          loading="eager"
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          imgRef={imgRef}
          draggable={false}
        />
      </button>
    </section>
  );
}
