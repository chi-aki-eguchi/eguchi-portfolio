import { useEffect } from "react";
import { Link } from "wouter";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAltText } from "../../../shared/photo-alt";
import { contactHrefForWork } from "../../../shared/contact-reference";
import { bookFacts, pad2, pageHash, pageIndexFromHash } from "../../lib/book";
import { FactLines } from "./BookFacts";
import {
  BookPhoto,
  BookPhotoPage,
  BookViewer,
  placementFor,
  useBookPager,
  useBookViewer,
} from "./BookParts";

type Settings = Record<string, string | null | undefined> | undefined;

/**
 * 作品ページの写真集の骨格（siteDesign = "book"）。
 *
 * 扉の見開き（題・言葉・事実・1枚目）→ 1画面に1枚ずつ → 奥付と次の章。
 * 頁には `#p-07` の番地があり、トップの「続き」と目次のコマからその頁へ
 * 直接開ける。
 */
export function BookSeries({
  series,
  photos,
  shelf,
  coverPhotoId,
  nextChapter,
  settings,
}: {
  series: { slug: string; title: string; subtitle?: string; statement?: string };
  photos: GalleryPhoto[];
  shelf: "series" | "work";
  coverPhotoId: number | null;
  nextChapter: { slug: string; title: string } | null;
  settings: Settings;
}) {
  const facts = bookFacts(photos);
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const viewer = useBookViewer(photos);
  useBookPager([photos.length, series.slug]);

  // 表紙を選んでいて、それが1枚目と違うときだけ扉に表紙を置く。
  // 選んでいなければ1枚目が扉の写真で、頁は2枚目から続く。
  const chosenCover =
    coverPhotoId != null && photos[0]?.id !== coverPhotoId
      ? (photos.find((p) => p.id === coverPhotoId) ?? null)
      : null;
  const openerPhoto = chosenCover ?? photos[0] ?? null;
  const openerIsFirstPage = !chosenCover && photos.length > 0;
  const firstPageIndex = openerIsFirstPage ? 1 : 0;

  // 番地つきで開いたら、その頁へ。最初の描画のあとに1度だけ動かす。
  useEffect(() => {
    const idx = pageIndexFromHash(window.location.hash);
    if (idx === null || idx >= photos.length) return;
    const t = window.setTimeout(() => {
      document.getElementById(pageHash(idx))?.scrollIntoView({ block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [photos.length, series.slug]);

  const shelfLabel = shelf === "work" ? settings?.navLabelWork || "Work" : "Series";
  const consult =
    shelf === "work" && (settings?.homeCtaEnabled ?? "off") === "on";

  return (
    <div className="book" data-book-view="series">
      <section
        className="book-spread book-opener"
        id={openerIsFirstPage ? pageHash(0) : undefined}
        data-book-page=""
        data-book-label={series.title}
        data-book-num={
          openerIsFirstPage ? `01 / ${pad2(photos.length)}` : `${photos.length}枚`
        }
      >
        <div className="book-spread__text">
          <p className="book-kicker font-en">{shelfLabel}</p>
          <h1 className="book-opener__title font-ja">{series.title}</h1>
          {series.subtitle && (
            <p className="book-opener__sub font-en">{series.subtitle}</p>
          )}
          {series.statement && (
            <p className="book-opener__statement font-ja">{series.statement}</p>
          )}
          <FactLines facts={facts} />
          <p className="book-opener__links">
            <Link
              to={`/series#sheet-${series.slug}`}
              className="book-link book-link--quiet font-ja"
            >
              ベタ焼きで全部を見る
            </Link>
          </p>
          {openerIsFirstPage && (
            <p className="book-page__folio book-page__folio--opener font-en">
              <span className="book-page__num">01</span>
              <span className="book-page__of">/ {pad2(photos.length)}</span>
            </p>
          )}
        </div>
        <div className="book-spread__photo">
          {openerPhoto && (
            <BookPhoto
              photo={openerPhoto}
              eager
              alt={photoAltText(openerPhoto, {
                photographerName,
                seriesName: series.title,
              })}
              sizes="(min-width: 768px) calc((100vw - 13rem) / 2), 100vw"
              onOpen={() =>
                viewer.open(Math.max(0, photos.findIndex((p) => p.id === openerPhoto.id)))
              }
              openLabel={`${series.title}の写真を拡大して見る`}
            />
          )}
        </div>
      </section>

      {photos.length === 0 && (
        <p className="book-empty font-ja">この作品群にはまだ写真がありません</p>
      )}

      {photos.slice(firstPageIndex).map((photo, i) => {
        const index = i + firstPageIndex;
        return (
          <BookPhotoPage
            key={photo.id}
            id={pageHash(index)}
            photo={photo}
            index={index}
            total={photos.length}
            label={series.title}
            placement={placementFor(photo, i)}
            eager={i === 0}
            onOpen={() => viewer.open(index)}
            photographerName={photographerName}
            language="ja"
          />
        );
      })}

      <section className="book-spread book-end" data-book-stop="">
        <div className="book-spread__text">
          <p className="book-kicker font-ja">奥付</p>
          <p className="book-end__title font-ja">{series.title}</p>
          <FactLines facts={facts} />
          {consult && (
            <p className="book-opener__links">
              <Link to={contactHrefForWork(series.slug)} className="book-link font-ja">
                この作品について相談する<span aria-hidden="true"> →</span>
              </Link>
            </p>
          )}
        </div>
        <nav className="book-end__next" aria-label="次に見る">
          {nextChapter && (
            <Link to={`/${shelf}/${nextChapter.slug}`} className="book-end__row">
              <span className="book-end__label font-ja">次の章</span>
              <span className="book-end__name font-ja">{nextChapter.title} →</span>
            </Link>
          )}
          <Link to="/series" className="book-end__row">
            <span className="book-end__label font-ja">目次</span>
            <span className="book-end__name font-ja">すべてのコマ（ベタ焼き） →</span>
          </Link>
          <Link to="/about" className="book-end__row">
            <span className="book-end__label font-en">
              {settings?.navLabelAbout || "About"}
            </span>
            <span className="book-end__name font-ja">
              {settings?.profileName || photographerName || "About"} →
            </span>
          </Link>
        </nav>
      </section>

      <BookViewer
        photos={photos}
        viewer={viewer}
        photographerName={photographerName}
        seriesName={series.title}
      />
    </div>
  );
}
