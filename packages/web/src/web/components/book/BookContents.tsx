import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ContentStatus } from "../ContentStatus";
import { orientedDimensions } from "../../../shared/image-url";
import { photoAltText } from "../../../shared/photo-alt";
import { srcFor } from "../../lib/picture";
import { mediumRuns, pad2, pageHash, type Medium } from "../../lib/book";
import { FactLines } from "./BookFacts";
import { useBookChapters } from "./useBookChapters";

const MEDIUM_LABEL: Record<Medium, { ja: string; en: string }> = {
  film: { ja: "フィルム", en: "Film" },
  digital: { ja: "デジタル", en: "Digital" },
  unknown: { ja: "媒体の記録なし", en: "Medium not recorded" },
};

/** 作品ごとに最初に描くコマの数。残りは、その作品の下の端に近づいたら描く。 */
const INITIAL_FRAMES = 40;

/**
 * 写真が1000枚を超えても目次が固まらないよう、作品ごとに最初の40コマだけ
 * 描き、下の端（目印）が画面に近づいたら残りを描く。番号・リンクは変わらない。
 * 2000枚・1451コマで計ったとき、スマホ（CPU 1/4）で開くまで 2.4秒・固まる
 * 時間 1.5秒だった（2026-09-23）。
 */
function SheetFrames({
  count,
  eagerAll,
  children,
}: {
  count: number;
  eagerAll?: boolean;
  children: (limit: number) => React.ReactNode;
}) {
  const [limit, setLimit] = useState(eagerAll ? count : Math.min(count, INITIAL_FRAMES));
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (limit >= count) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setLimit(count);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit(count);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [limit, count]);
  // 番地（#sheet-…）やコマへの移動の前に、その作品は全部描いておく。
  useEffect(() => {
    const onHash = () => setLimit(count);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [count]);
  return (
    <>
      {children(limit)}
      {limit < count && <div ref={sentinel} className="book-sheet__more" aria-hidden="true" />}
    </>
  );
}

/**
 * 目次（ベタ焼き）。すべての章のコマを、作品ページと同じ順・同じ番号で並べる。
 *
 * **媒体は写真1枚ずつの記録に従う。** フィルムのコマは黒い帯に、デジタルの
 * コマは紙の上にそのまま置く。デジタルの写真に帯や枠を付けたり、フィルムの
 * 銘柄・コマ番号の刻印を作ったりはしない。番号は作品の中の順番で、フィルムの
 * 実際のコマ番号ではない（凡例にもそう書く）。
 *
 * コマを押すと、作品ページのその頁（`#p-07`）へ開く。
 */
export function BookContents({ focusShelf }: { focusShelf?: "series" | "work" }) {
  const { chapters, isLoading, isError, refetch, settings } = useBookChapters();
  const photographerName = settings?.siteName || settings?.siteNameEn || "";

  // `/series#sheet-sicf` のような番地、または Work の棚から来たときは、
  // 中身が届いてからその章へ動かす。
  useEffect(() => {
    if (chapters.length === 0) return;
    const hash = window.location.hash;
    const target = hash.startsWith("#sheet-")
      ? document.getElementById(hash.slice(1))
      : focusShelf === "work"
        ? document.querySelector<HTMLElement>('[data-sheet-kind="work"]')
        : null;
    if (!target) return;
    const t = window.setTimeout(() => target.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [chapters.length, focusShelf]);

  return (
    <div className="book book-contents" data-book-view="contents">
      <header className="book-contents__head">
        <h1 className="book-contents__title font-ja">目次</h1>
        <p className="book-contents__lede font-ja">
          すべての作品のコマを、作品の中の順番で並べています。押すとその頁から開きます。
        </p>
        <ul className="book-legend font-ja" aria-label="凡例">
          <li>
            <span className="book-legend__swatch book-legend__swatch--film" aria-hidden="true" />
            黒い帯 — フィルムで撮った写真
          </li>
          <li>
            <span className="book-legend__swatch book-legend__swatch--digital" aria-hidden="true" />
            紙の上 — デジタルで撮った写真
          </li>
          <li className="book-legend__note">番号は作品の中の順番（フィルムのコマ番号とは別）</li>
        </ul>
      </header>

      {isLoading && chapters.length === 0 && <ContentStatus state="loading" />}
      {isError && chapters.length === 0 && (
        <ContentStatus state="error" onRetry={refetch} />
      )}

      {chapters.map((chapter, ci) => (
        <section
          key={chapter.slug}
          id={`sheet-${chapter.slug}`}
          className="book-sheet"
          data-sheet-kind={chapter.kind}
          aria-labelledby={`sheet-title-${chapter.slug}`}
        >
          <div className="book-sheet__head">
            <p className="book-kicker font-en">
              {pad2(ci + 1)}
              <span className="book-kicker__shelf">
                {chapter.kind === "work" ? settings?.navLabelWork || "Work" : "Series"}
              </span>
            </p>
            <h2 id={`sheet-title-${chapter.slug}`} className="book-sheet__title font-ja">
              <Link to={chapter.href}>{chapter.title}</Link>
            </h2>
            <FactLines facts={chapter.facts} />
          </div>

          <SheetFrames count={chapter.photos.length} eagerAll={ci === 0 && chapter.photos.length <= INITIAL_FRAMES}>
            {(limit) => (
          <div className="book-sheet__frames">
            {mediumRuns(chapter.photos.slice(0, limit)).map((run) => (
              <div
                key={`${run.medium}-${run.start}`}
                className="book-run"
                data-medium={run.medium}
              >
                <p className="book-run__label font-ja">
                  {MEDIUM_LABEL[run.medium].ja}
                  <span className="font-en"> {run.photos.length}</span>
                </p>
                <ol className="book-run__frames" start={run.start + 1}>
                  {run.photos.map((photo, i) => {
                    const index = run.start + i;
                    const dims = orientedDimensions(
                      photo.width,
                      photo.height,
                      photo.rotationDeg,
                    );
                    const ar =
                      dims.width && dims.height ? dims.width / dims.height : 4 / 5;
                    const alt = photoAltText(photo, {
                      photographerName,
                      seriesName: chapter.title,
                    });
                    return (
                      <li key={photo.id} className="book-frame">
                        <Link
                          to={`${chapter.href}#${pageHash(index)}`}
                          className="book-frame__link"
                          aria-label={`${chapter.title} ${pad2(index + 1)}`}
                        >
                          <span
                            className="book-frame__img"
                            style={{ "--book-ar": String(ar) } as React.CSSProperties}
                          >
                            <img
                              src={photo.thumbUrl ?? srcFor(photo.url, 320, 70, undefined, photo.rotationDeg)}
                              alt={alt}
                              loading={ci === 0 && index < 16 ? "eager" : "lazy"}
                              decoding="async"
                              draggable={false}
                            />
                          </span>
                          <span className="book-frame__num font-en">{pad2(index + 1)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
            )}
          </SheetFrames>
        </section>
      ))}
    </div>
  );
}
