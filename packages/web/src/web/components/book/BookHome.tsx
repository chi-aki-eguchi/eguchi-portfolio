import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import { HeroPicture } from "../HeroPicture";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAltText } from "../../../shared/photo-alt";
import { orientedDimensions } from "../../../shared/image-url";
import { pad2 } from "../../lib/book";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { BookPhoto, BookViewer, useBookDevelop, useBookViewer } from "./BookParts";
import { WorksGrid } from "./BookWorks";
import { useBookChapters, useBookGalleryEntry, type BookChapter } from "./useBookChapters";

type Settings = Record<string, string | null | undefined> | undefined;

/** トップの写真の束に入れる枚数の上限。 */
const MAX_SLIDES = 8;
/** トップの「写真」に並べる枚数。作品に入っていない写真も含め、毎回変わる。 */
const FIELD_COUNT = 18;

/**
 * トップの最初の画面に出す写真の並び。
 *  1. 管理画面「写真集のトップの写真」で選んだ1枚（公開中なら）を先頭に
 *  2. HERO の写真（管理画面の HERO で選んだ順）
 *  3. どちらも無ければ、各作品の表紙
 * 同じ写真は2度入れない。
 */
export function heroSlides(
  chapters: BookChapter[],
  heroPhotos: GalleryPhoto[],
  chosenId: string | null | undefined,
): GalleryPhoto[] {
  const all = chapters.flatMap((c) => c.photos);
  const chosen = chosenId ? all.find((p) => String(p.id) === chosenId) : undefined;
  const out: GalleryPhoto[] = [];
  const seen = new Set<number>();
  const add = (p: GalleryPhoto | undefined | null) => {
    if (!p || seen.has(p.id) || out.length >= MAX_SLIDES) return;
    seen.add(p.id);
    out.push(p);
  };
  add(chosen);
  heroPhotos.forEach(add);
  if (out.length === 0) {
    for (const c of chapters) {
      add(
        (c.coverPhotoId != null ? c.photos.find((p) => p.id === c.coverPhotoId) : undefined) ??
          c.photos[0],
      );
    }
  }
  return out;
}

/**
 * 最初の画面の写真。写真の全体を、元の縦横比のまま画面に収める。
 * 切り抜かない・引き伸ばさない・拡大しない（2026-09-26 オーナー
 * 「元の写真をもっと尊重して」）。
 *
 * 送るのは押したときだけ（自動では変わらない。2026-09-08 オーナー判断と
 * 同じ）。右の3分の2を押すと次、左の3分の1で前。矢印キーも同じ。
 * 下の端には、その写真が入っている作品へのリンクと枚数だけを置く。
 */
function BookHero({
  slides,
  seriesLinkById,
  photographerName,
}: {
  slides: GalleryPhoto[];
  seriesLinkById: Record<number, { name: string; href: string }>;
  photographerName: string;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const go = useCallback(
    (step: number) => setIndex((i) => (count ? (i + step + count) % count : 0)),
    [count],
  );
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (document.querySelector("dialog[open]")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const r = heroRef.current?.getBoundingClientRect();
      if (!r || r.bottom < window.innerHeight * 0.5) return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (count === 0) return <section ref={heroRef} className="bk-hero bk-hero--empty" />;
  const current = slides[index]!;
  const link = current.seriesId != null ? seriesLinkById[current.seriesId] : undefined;
  // 描くのは、いま・前後の3枚だけ（前後は先に読んでおく）。
  const near = new Set([index, (index + 1) % count, (index - 1 + count) % count]);

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (count < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX < r.left + r.width / 3 ? -1 : 1);
  };

  return (
    <section ref={heroRef} className="bk-hero bk-bleed" aria-roledescription="carousel" aria-label="写真">
      {/* 押す場所で送るのはマウスの近道。下の ← → と矢印キーでも同じ。 */}
      <div className="bk-hero__stage" role="presentation" onClick={onStageClick} data-multi={count > 1 ? "" : undefined}>
        {slides.map((photo, i) =>
          near.has(i) ? (
            <div key={photo.id} className="bk-hero__slide" data-active={i === index ? "" : undefined} aria-hidden={i !== index}>
              <HeroPicture
                url={photo.url}
                thumbUrl={photo.thumbUrl}
                mediumUrl={photo.mediumUrl}
                width={photo.width}
                height={photo.height}
                rotationDeg={photo.rotationDeg}
                focalX={photo.focalX}
                focalY={photo.focalY}
                alt={i === index ? photoAltText(photo, { photographerName, seriesName: seriesLinkById[photo.seriesId ?? -1]?.name }) : ""}
                sizes="100vw"
                className="bk-hero__img"
                style={{ objectPosition: "50% 50%" }}
                fetchPriority={i === index ? "high" : "low"}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </div>
          ) : null,
        )}
      </div>
      <div className="bk-hero__meta">
        {link ? (
          <Link to={link.href} className="bk-hero__work font-ja">
            {link.name}
            <span aria-hidden="true"> →</span>
          </Link>
        ) : (
          <span />
        )}
        {count > 1 && (
          <span className="bk-hero__nav font-en">
            <button type="button" onClick={() => go(-1)} aria-label="前の写真">
              ←
            </button>
            <span aria-live="polite">
              {pad2(index + 1)} / {pad2(count)}
            </span>
            <button type="button" onClick={() => go(1)} aria-label="次の写真">
              →
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * 写真を縦の列へ振り分ける（いちばん短い列へ順に足す）。返すのは各列の添字。
 *
 * CSS の段組み（columns）は使わない。Safari（WebKit）では、段組みの中に
 * position: relative の枠があると2列目以降が描かれず空白になった（2026-09-26）。
 */
export function splitIntoColumns(photos: GalleryPhoto[], count: number): number[][] {
  const cols: number[][] = Array.from({ length: Math.max(1, count) }, () => []);
  const heights = cols.map(() => 0);
  photos.forEach((photo, i) => {
    const d = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
    const h = d.width && d.height ? d.height / d.width : 1.25;
    const shortest = heights.indexOf(Math.min(...heights));
    cols[shortest]!.push(i);
    heights[shortest]! += h;
  });
  return cols;
}

const WIDE_FIELD = "(min-width: 1024px)";

/** 広い画面は3列、それ以外は2列。 */
function useFieldColumnCount() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(WIDE_FIELD).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_FIELD);
    if (!mq) return;
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide ? 3 : 2;
}

/**
 * 写真の比のまま、段組みで大きく並べる。押すとその場でビューアが開く。
 * トップの Photos（毎回違う組み合わせ）と、Photos のページ（すべての写真）で使う。
 */
export function PhotoField({
  photos,
  photographerName,
  seriesLinkById,
}: {
  photos: GalleryPhoto[];
  photographerName: string;
  seriesLinkById: Record<number, { name: string; href: string }>;
}) {
  const viewer = useBookViewer(photos);
  const columnCount = useFieldColumnCount();
  const columns = useMemo(() => splitIntoColumns(photos, columnCount), [photos, columnCount]);
  useBookDevelop([columnCount]);
  return (
    <>
      <div className="bk-field">
        {columns.map((indices, c) => (
          <ul key={c} className="bk-field__col">
            {indices.map((i) => {
              const photo = photos[i]!;
              return (
                <li key={photo.id} className="bk-field__item">
                  <BookPhoto
                    photo={photo}
                    alt={photoAltText(photo, {
                      photographerName,
                      seriesName: seriesLinkById[photo.seriesId ?? -1]?.name,
                    })}
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    onOpen={() => viewer.open(i)}
                    openLabel="この写真を大きく見る"
                  />
                </li>
              );
            })}
          </ul>
        ))}
      </div>
      <BookViewer
        photos={photos}
        viewer={viewer}
        photographerName={photographerName}
        seriesLinkById={seriesLinkById}
      />
    </>
  );
}

/**
 * 写真集の骨格のトップ（siteDesign = "book"、2026-09-25 見直し）。
 *
 * 画面いっぱいの写真 → 作品（大きな表紙）→ いろいろな写真。
 * それまでの「縦書きの扉と目次 → 章ごとに5枚」は、写真が小さく余白が
 * 多いうえ、作品に入っていない写真の居場所が無かった（2026-09-25 オーナー）。
 */
export function BookHome({
  settings,
  heroPhotos,
}: {
  settings: Settings;
  heroPhotos: GalleryPhoto[];
}) {
  const { chapters, isLoading, isError, refetch } = useBookChapters();
  const seriesLinkById = useSeriesLinks();
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const gallery = useBookGalleryEntry(settings);
  const slides = useMemo(
    () => heroSlides(chapters, heroPhotos, settings?.bookCoverPhotoId),
    [chapters, heroPhotos, settings?.bookCoverPhotoId],
  );
  const { data: fieldData } = useQuery({
    queryKey: ["photos", "book-field", FIELD_COUNT],
    queryFn: async () =>
      jsonOrThrow(
        await api.photos.$get({ query: { limit: String(FIELD_COUNT), order: "random" } }),
      ),
    staleTime: 5 * 60_000,
  });
  const field = useMemo(() => {
    const onHero = new Set(slides.map((p) => p.id));
    return ((fieldData?.photos ?? []) as GalleryPhoto[]).filter((p) => !onHero.has(p.id));
  }, [fieldData, slides]);
  useBookDevelop([chapters.length, field.length]);

  return (
    <div className="book" data-book-view="home">
      <h1 className="sr-only">{photographerName}</h1>
      <BookHero slides={slides} seriesLinkById={seriesLinkById} photographerName={photographerName} />

      {isLoading && chapters.length === 0 && <ContentStatus state="loading" />}
      {isError && chapters.length === 0 && <ContentStatus state="error" onRetry={refetch} />}

      {chapters.length > 0 && (
        <section className="bk-section" aria-labelledby="bk-works-head">
          <header className="bk-section__head">
            <h2 id="bk-works-head" className="bk-section__title font-en">
              Works
            </h2>
            <Link to="/series?view=list" className="bk-section__aside font-ja">
              作品名で見る<span aria-hidden="true"> →</span>
            </Link>
          </header>
          <WorksGrid chapters={chapters} photographerName={photographerName} headingLevel={3} />
        </section>
      )}

      {field.length > 0 && (
        <section className="bk-section" aria-labelledby="bk-photos-head">
          <header className="bk-section__head">
            <h2 id="bk-photos-head" className="bk-section__title font-en">
              Photos
            </h2>
            {gallery && (
              <Link to={gallery.href} className="bk-section__aside font-ja">
                {gallery.label}
                {gallery.count != null && <span className="font-en">（{gallery.count}）</span>}
                <span aria-hidden="true"> →</span>
              </Link>
            )}
          </header>
          <PhotoField photos={field} photographerName={photographerName} seriesLinkById={seriesLinkById} />
        </section>
      )}
    </div>
  );
}
