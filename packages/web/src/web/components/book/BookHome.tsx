import { useMemo } from "react";
import { Link } from "wouter";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAltText } from "../../../shared/photo-alt";
import { pad2, pageHash } from "../../lib/book";
import { FactLines } from "./BookFacts";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import {
  BookCounter,
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

/**
 * 写真集の骨格のトップ（siteDesign = "book"）。
 *
 * 扉（名前と目次と1枚）→ 章ごとに「扉の見開き」と数枚の頁 → 続きへの入口。
 * 写真はランダムにせず、作品ページと同じ順で出す。どの写真がどの章の
 * 何枚目なのかが、頁番号でいつも分かる。
 */
export function BookHome({
  settings,
  heroPhoto: pickedHero,
}: {
  settings: Settings;
  heroPhoto: GalleryPhoto | null;
}) {
  const { chapters, isLoading, isError, refetch } = useBookChapters();
  const seriesLinkById = useSeriesLinks();
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  // HERO を選んでいなければ、最初の章の1枚目を扉に置く（章の側では飛ばす）。
  const heroPhoto = pickedHero ?? chapters[0]?.photos[0] ?? null;

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
  const current = useBookPager([plan.length, shown.length]);

  const nameJa = settings?.siteName || "";
  const nameEn = settings?.siteNameEn || "";

  return (
    <div className="book" data-book-view="home">
      <section className="book-spread book-title" data-book-stop="">
        <div className="book-spread__text">
          <p className="book-kicker font-ja">写真</p>
          <h1 className="book-title__name font-ja">{nameJa || nameEn}</h1>
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
              sizes="(min-width: 768px) calc((100vw - 13rem) / 2), 100vw"
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
                  sizes="(min-width: 768px) calc((100vw - 13rem) / 2), 100vw"
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

      <BookCounter current={current} />
      <BookViewer
        photos={shown}
        viewer={viewer}
        photographerName={photographerName}
        seriesLinkById={seriesLinkById}
      />
    </div>
  );
}
