import { Link, useSearch } from "wouter";
import { photoAltText } from "../../../shared/photo-alt";
import { mediumLine, pad2 } from "../../lib/book";
import { BookPhoto } from "./BookParts";
import type { BookChapter } from "./useBookChapters";

/** 作品の表紙: 選んだ表紙（公開中なら）、無ければ1枚目。 */
export function chapterCover(chapter: BookChapter) {
  return (
    (chapter.coverPhotoId != null
      ? chapter.photos.find((p) => p.id === chapter.coverPhotoId)
      : undefined) ?? chapter.photos[0] ?? null
  );
}

/** 「2025–2026」。デジタルの撮影日だけから（フィルムの日付は複写日時）。 */
export function chapterYears(chapter: BookChapter): string {
  const period = chapter.facts.digitalPeriod;
  if (!period) return "";
  const years = period.split("–").map((part) => part.split(".")[0]);
  return years[0] === years[1] || years.length === 1 ? years[0]! : `${years[0]}–${years[1]}`;
}

/**
 * 作品を大きな表紙で並べる（Works の Grid・トップの作品）。
 *
 * 表紙は同じ比（3:2）の枠に、写真の「見せる中心」を軸に切り抜く。比が
 * ばらばらだと、2〜3本しかないときに列の下端がずれて、並びが崩れて見える。
 */
export function WorksGrid({
  chapters,
  photographerName,
  headingLevel = 2,
}: {
  chapters: BookChapter[];
  photographerName: string;
  headingLevel?: 2 | 3;
}) {
  const Title = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className="bk-works" data-count={Math.min(chapters.length, 3)}>
      {chapters.map((chapter, i) => {
        const cover = chapterCover(chapter);
        return (
          <li key={chapter.slug} className="bk-work">
            <Link to={chapter.href} className="bk-work__link">
              {cover && (
                <BookPhoto
                  photo={cover}
                  coverRatio={3 / 2}
                  eager={i < 2}
                  alt={photoAltText(cover, { photographerName, seriesName: chapter.title })}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  openLabel=""
                />
              )}
              <span className="bk-work__meta">
                <Title className="bk-work__title font-ja">{chapter.title}</Title>
                <span className="bk-work__facts font-en">
                  {[chapterYears(chapter), `${chapter.facts.count}`].filter(Boolean).join(" · ")}
                  <span className="font-ja">枚</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** 作品名で読む一覧（Works の List）。 */
export function WorksList({ chapters }: { chapters: BookChapter[] }) {
  return (
    <ol className="bk-list">
      {chapters.map((chapter, i) => {
        const cover = chapterCover(chapter);
        return (
          <li key={chapter.slug}>
            <Link to={chapter.href} className="bk-list__row">
              <span className="bk-list__num font-en">{pad2(i + 1)}</span>
              <span className="bk-list__title font-ja">
                {chapter.title}
                {chapter.subtitle && (
                  <span className="bk-list__sub font-en">{chapter.subtitle}</span>
                )}
              </span>
              <span className="bk-list__medium font-ja">{mediumLine(chapter.facts, "ja")}</span>
              <span className="bk-list__years font-en">{chapterYears(chapter)}</span>
              <span className="bk-list__count font-en">
                {chapter.facts.count}
                <span className="font-ja">枚</span>
              </span>
              {cover?.thumbUrl && (
                <img className="bk-list__peek" src={cover.thumbUrl} alt="" aria-hidden="true" loading="lazy" />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Grid / List の切り替え。`?view=list` で覚える（共有・戻るでも同じ見え方）。 */
export function useWorksView(): "grid" | "list" {
  const search = useSearch();
  return new URLSearchParams(search).get("view") === "list" ? "list" : "grid";
}

export function WorksViewSwitch({ base, view }: { base: string; view: "grid" | "list" }) {
  return (
    <nav className="bk-switch font-en" aria-label="表示の切り替え">
      <Link to={base} aria-current={view === "grid" ? "page" : undefined}>
        Grid
      </Link>
      <Link to={`${base}?view=list`} aria-current={view === "list" ? "page" : undefined}>
        List
      </Link>
    </nav>
  );
}
