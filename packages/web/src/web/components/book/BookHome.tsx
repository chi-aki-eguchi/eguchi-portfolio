import { useMemo } from "react";
import { Link } from "wouter";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAltText } from "../../../shared/photo-alt";
import { pad2, pageHash } from "../../lib/book";
import { FactLines } from "./BookFacts";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import {
  BookPhoto,
  BookPhotoPage,
  BookViewer,
  placementFor,
  useBookPager,
  useBookViewer,
} from "./BookParts";
import { useBookChapters, type BookChapter } from "./useBookChapters";

/** 章ごとにトップで見せる枚数。残りは作品ページで続きから読む。 */
const EXCERPT = 5;

type Settings = Record<string, string | null | undefined> | undefined;

type ShownPage = {
  chapter: BookChapter;
  photo: GalleryPhoto;
  /** 章の中での位置（0 始まり）。頁番号はここから出す。 */
  index: number;
};

function chapterCover(chapter: BookChapter, skip: Set<number>) {
  const chosen =
    chapter.coverPhotoId != null
      ? chapter.photos.find((p) => p.id === chapter.coverPhotoId)
      : undefined;
  return (
    (chosen && !skip.has(chosen.id) ? chosen : undefined) ??
    chapter.photos.find((p) => !skip.has(p.id)) ??
    null
  );
}

/** 作品ページの扉に出る写真（表紙を選んでいればそれ、無ければ1枚目）。 */
function seriesOpenerId(chapter: BookChapter): number | undefined {
  const chosen =
    chapter.coverPhotoId != null
      ? chapter.photos.find((p) => p.id === chapter.coverPhotoId)
      : undefined;
  return (chosen ?? chapter.photos[0])?.id;
}

/**
 * トップの扉の写真。
 *  1. 管理画面「写真集のトップの写真」で選んだ1枚（公開中なら）
 *  2. 自動: HERO の写真のうち、どの作品の扉とも重ならない最初の1枚
 *  3. 自動: 最初の章の、扉ではない最初の写真
 * 自動のときに作品の扉と同じ写真を避けるのは、トップを開いて作品へ進むと
 * 同じ写真が続いてしまうため（2026-09-23 オーナー指摘）。
 */
export function titlePhoto(
  chapters: BookChapter[],
  heroPhotos: GalleryPhoto[],
  chosenId: string | null | undefined,
): GalleryPhoto | null {
  const all = chapters.flatMap((c) => c.photos);
  const chosen = chosenId ? all.find((p) => String(p.id) === chosenId) : undefined;
  if (chosen) return chosen;
  const openers = new Set(chapters.map(seriesOpenerId));
  const hero = heroPhotos.find((p) => !openers.has(p.id));
  if (hero) return hero;
  const first = chapters[0];
  return (
    first?.photos.find((p) => !openers.has(p.id)) ??
    heroPhotos[0] ??
    first?.photos[0] ??
    null
  );
}

/**
 * 写真集の骨格のトップ（siteDesign = "book"）。
 *
 * 扉（名前と目次と1枚）→ 章ごとに「扉の見開き」と数枚の頁 → 続きへの入口。
 * 写真はランダムにせず、作品ページと同じ順で出す。どの写真がどの章の
 * 何枚目なのかが、頁番号でいつも分かる。
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
  const heroPhoto = useMemo(
    () => titlePhoto(chapters, heroPhotos, settings?.bookCoverPhotoId),
    [chapters, heroPhotos, settings?.bookCoverPhotoId],
  );

  const plan = useMemo(() => {
    const used = new Set<number>();
    if (heroPhoto) used.add(heroPhoto.id);
    return chapters.map((chapter) => {
      const cover = chapterCover(chapter, used);
      if (cover) used.add(cover.id);
      const pages: ShownPage[] = [];
      chapter.photos.forEach((photo, index) => {
        if (pages.length >= EXCERPT || used.has(photo.id)) return;
        used.add(photo.id);
        pages.push({ chapter, photo, index });
      });
      const lastShown = pages.length ? pages[pages.length - 1]!.index : -1;
      return { chapter, cover, pages, resumeAt: lastShown + 1 };
    });
  }, [chapters, heroPhoto]);

  // ビューアは、トップに出ている写真を頁の順に送る。
  const shown = useMemo(() => {
    const list: GalleryPhoto[] = [];
    if (heroPhoto) list.push(heroPhoto);
    plan.forEach(({ cover, pages }) => {
      if (cover) list.push(cover);
      pages.forEach((p) => list.push(p.photo));
    });
    return list;
  }, [plan, heroPhoto]);
  const viewer = useBookViewer(shown);
  const openById = (id: number) => {
    const i = shown.findIndex((p) => p.id === id);
    if (i >= 0) viewer.open(i);
  };
  useBookPager([plan.length, shown.length]);

  const nameJa = settings?.siteName || "";
  const nameEn = settings?.siteNameEn || "";

  return (
    <div className="book" data-book-view="home">
      <section className="book-spread book-title" data-book-stop="">
        <div className="book-spread__text">
          <p className="book-kicker font-ja">写真</p>
          {/* 縦に組むのは漢字・かなの名前だけ。英字を縦にすると横倒しで
              画面の下まで伸びる（配布版の既定名 "Photographer Name" で確認）。 */}
          <h1
            className="book-title__name font-ja"
            data-vertical={/[\u3040-\u30ff\u3400-\u9fff]/.test(nameJa || nameEn) ? "" : undefined}
          >
            {nameJa || nameEn}
          </h1>
          {nameJa && nameEn && (
            <p className="book-title__en font-en">{nameEn}</p>
          )}
          {chapters.length > 0 && (
            <nav className="book-toc" aria-label="目次">
              <p className="book-toc__head font-ja">目次</p>
              <ol>
                {chapters.map((c, i) => (
                  <li key={c.slug}>
                    <a href={`#chapter-${c.slug}`} className="book-toc__row">
                      <span className="book-toc__num font-en">{pad2(i + 1)}</span>
                      <span className="book-toc__name font-ja">{c.title}</span>
                      <span className="book-toc__count font-en">{c.facts.count}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <Link to="/series" className="book-link font-ja">
                すべてのコマをベタ焼きで見る
                <span aria-hidden="true"> →</span>
              </Link>
            </nav>
          )}
        </div>
        <div className="book-spread__photo">
          {heroPhoto && (
            <BookPhoto
              photo={heroPhoto}
              eager
              alt={photoAltText(heroPhoto, { photographerName })}
              sizes="(min-width: 768px) 50vw, 100vw"
              onOpen={() => openById(heroPhoto.id)}
              openLabel="この写真を拡大して見る"
            />
          )}
        </div>
      </section>

      {isLoading && chapters.length === 0 && <ContentStatus state="loading" />}
      {isError && chapters.length === 0 && (
        <ContentStatus state="error" onRetry={refetch} />
      )}

      {plan.map(({ chapter, cover, pages, resumeAt }, ci) => (
        <div key={chapter.slug} className="book-chapter">
          <section
            id={`chapter-${chapter.slug}`}
            className="book-spread book-opener"
            data-book-stop=""
          >
            <div className="book-spread__text">
              <p className="book-kicker font-en">
                {pad2(ci + 1)}
                <span className="book-kicker__shelf">
                  {chapter.kind === "work" ? "Work" : "Series"}
                </span>
              </p>
              <h2 className="book-opener__title font-ja">{chapter.title}</h2>
              {chapter.subtitle && (
                <p className="book-opener__sub font-en">{chapter.subtitle}</p>
              )}
              {chapter.statement && (
                <p className="book-opener__statement font-ja">
                  {chapter.statement}
                </p>
              )}
              <FactLines facts={chapter.facts} />
              <p className="book-opener__links">
                <Link to={chapter.href} className="book-link font-ja">
                  最初から見る<span aria-hidden="true"> →</span>
                </Link>
                <Link
                  to={`/series#sheet-${chapter.slug}`}
                  className="book-link book-link--quiet font-ja"
                >
                  ベタ焼き
                </Link>
              </p>
            </div>
            <div className="book-spread__photo">
              {cover && (
                <BookPhoto
                  photo={cover}
                  alt={photoAltText(cover, {
                    photographerName,
                    seriesName: chapter.title,
                  })}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  onOpen={() => openById(cover.id)}
                  openLabel={`${chapter.title}の写真を拡大して見る`}
                />
              )}
            </div>
          </section>

          {pages.map((p, pi) => (
            <BookPhotoPage
              key={p.photo.id}
              photo={p.photo}
              index={p.index}
              total={chapter.photos.length}
              label={chapter.title}
              placement={placementFor(p.photo, pi)}
              onOpen={() => openById(p.photo.id)}
              photographerName={photographerName}
              language="ja"
            />
          ))}

          {resumeAt < chapter.photos.length && (
            <p className="book-continue" data-book-stop="">
              <Link
                to={`${chapter.href}#${pageHash(resumeAt)}`}
                className="book-continue__link"
              >
                <span className="book-continue__label font-ja">
                  {chapter.title}の続き
                </span>
                <span className="book-continue__num font-en">
                  {pad2(resumeAt + 1)} — {pad2(chapter.photos.length)}
                  <span aria-hidden="true"> →</span>
                </span>
              </Link>
            </p>
          )}
        </div>
      ))}

      <BookViewer
        photos={shown}
        viewer={viewer}
        photographerName={photographerName}
        seriesLinkById={seriesLinkById}
      />
    </div>
  );
}
