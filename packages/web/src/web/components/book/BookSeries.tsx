import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import type { GalleryPhoto } from "../PhotoGallery";
import { Picture } from "../Picture";
import { photoAltText } from "../../../shared/photo-alt";
import { contactHrefForWork } from "../../../shared/contact-reference";
import {
  bookFacts,
  mediumRuns,
  pad2,
  pageHash,
  pageIndexFromHash,
  type Medium,
} from "../../lib/book";
import { FactLines } from "./BookFacts";
import { orientedDimensions } from "../../../shared/image-url";

type Settings = Record<string, string | null | undefined> | undefined;

const MEDIUM_LABEL: Record<Medium, string> = {
  film: "フィルム",
  digital: "デジタル",
  unknown: "媒体の記録なし",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const WIDE_QUERY = "(min-width: 900px) and (min-aspect-ratio: 5/4)";

/** 横に広い画面か（縦の写真2枚を見開きで並べられるか）。 */
function useWideScreen(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function isPortrait(p: GalleryPhoto): boolean {
  const d = orientedDimensions(p.width, p.height, p.rotationDeg);
  return !!(d.width && d.height && d.width / d.height < 0.9);
}

/**
 * 画面ごとの写真の組。広い画面では、縦の写真が2枚続けば見開きで1組に
 * する（1枚だと左右が大きく空く。2026-09-25 オーナー「余白が多い」）。
 * 横の写真・続かない縦の写真・狭い画面では1枚ずつ。並び順は変えない。
 */
export function stageGroups(photos: GalleryPhoto[], wide: boolean): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < photos.length; ) {
    if (wide && i + 1 < photos.length && isPortrait(photos[i]!) && isPortrait(photos[i + 1]!)) {
      groups.push([i, i + 1]);
      i += 2;
    } else {
      groups.push([i]);
      i += 1;
    }
  }
  return groups;
}

/** 1枚の写真。画面に収まる最大の大きさで、切り抜かない。 */
function StagePhoto({
  photo,
  alt,
  hidden,
}: {
  photo: GalleryPhoto;
  alt: string;
  hidden?: boolean;
}) {
  return (
    <Picture
      url={photo.url}
      width={photo.width}
      height={photo.height}
      rotationDeg={photo.rotationDeg}
      alt={hidden ? "" : alt}
      preset="lightbox"
      sizes="100vw"
      fallbackW={1920}
      fallbackQ={84}
      className="bk-stage__img"
      loading="eager"
      fetchPriority={hidden ? "low" : "high"}
      draggable={false}
    />
  );
}

/**
 * 作品ページの写真集の骨格（siteDesign = "book"、2026-09-25 見直し）。
 *
 * 画面の中で1枚ずつ送る。写真は画面に収まる最大の大きさ（切り抜かない）。
 * 下の帯に、作品名・枚数・送り・Index（その作品の全コマ）・Info（作品の
 * 言葉と事実）。最後の写真の次は奥付（次の作品・相談）。
 *
 * - 送り方: 写真の右側を押す／→ で次、左側／← で前。スマホは左右に払う。
 * - 番地: いま見ている写真を `#p-07` で持つ。トップ・Works・共有したURLから
 *   その写真で開ける。
 * - それまでの「縦に1頁ずつ」は、縦の写真の左右が大きく空いていた。
 */
export function BookSeries({
  series,
  photos,
  shelf,
  nextChapter,
  settings,
}: {
  series: { slug: string; title: string; subtitle?: string; statement?: string };
  photos: GalleryPhoto[];
  shelf: "series" | "work";
  coverPhotoId?: number | null;
  nextChapter: { slug: string; title: string } | null;
  settings: Settings;
}) {
  const total = photos.length;
  const facts = bookFacts(photos);
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const consult = shelf === "work" && (settings?.homeCtaEnabled ?? "off") === "on";

  const readHash = useCallback(() => {
    const i = pageIndexFromHash(window.location.hash);
    return i !== null && i < total ? i : 0;
  }, [total]);
  // index === total は奥付。
  const [index, setIndex] = useState(() => (typeof window === "undefined" ? 0 : readHash()));
  const [panel, setPanel] = useState<"index" | "info" | null>(null);
  // 前の写真は、次の写真が読み込めるまで下に残す（空白を挟まない入れ替え）。
  const [under, setUnder] = useState<number[] | null>(null);
  const wide = useWideScreen();
  const groups = useMemo(() => stageGroups(photos, wide), [photos, wide]);
  // いまの組（奥付では -1）。
  const g = index >= total ? -1 : groups.findIndex((grp) => grp.includes(index));
  const group = g >= 0 ? groups[g]! : [];
  const groupKey = group.join("-");
  const shownRef = useRef<number[]>(group);

  // 写真が届いた・別の作品へ移ったら、番地から開き直す。
  useEffect(() => {
    setIndex(readHash());
    setPanel(null);
  }, [readHash, series.slug]);

  // 番地を合わせる（履歴は積まない。戻るは前のページへ）。
  useEffect(() => {
    if (total === 0) return;
    const hash = `#${pageHash(Math.min(group[0] ?? index, total - 1))}`;
    if (window.location.hash !== hash)
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, index, total]);

  // Index のコマ（<a href="#p-07">）や外から番地が変わったとき。
  useEffect(() => {
    const onHash = () => {
      const i = pageIndexFromHash(window.location.hash);
      if (i !== null && i < total) {
        setIndex(i);
        setPanel(null);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [total]);

  useEffect(() => {
    const prev = shownRef.current;
    if (prev.join("-") === groupKey) return;
    shownRef.current = group;
    setUnder(prev.length ? prev : null);
    const t = window.setTimeout(() => setUnder(null), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  // 組ごとに送る。最後の組の次は奥付、奥付の前は最後の組。
  const go = useCallback(
    (step: number) =>
      setIndex((i) => {
        const at = i >= total ? groups.length : groups.findIndex((grp) => grp.includes(i));
        const to = at + step;
        if (to >= groups.length) return total;
        return groups[Math.max(0, to)]?.[0] ?? 0;
      }),
    [groups, total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (isTypingTarget(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "Escape" && panel) {
        setPanel(null);
        return;
      }
      if (panel) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, panel]);

  // 左右に払う（スマホ）。縦の動きが大きいときはスクロールとみなす。
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") touch.current = { x: e.clientX, y: e.clientY };
  };
  const swiped = useRef(false);
  const onPointerUp = (e: React.PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };
  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    // 奥付の中の文字やリンクを押したときは送らない。
    if ((e.target as HTMLElement).closest(".bk-colophon")) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX < r.left + r.width / 3 ? -1 : 1);
  };

  const counterText = (grp: number[]) =>
    grp.length > 1 ? `${pad2(grp[0]! + 1)}–${pad2(grp[grp.length - 1]! + 1)}` : pad2((grp[0] ?? 0) + 1);
  const alt = (p: GalleryPhoto) => photoAltText(p, { photographerName, seriesName: series.title });
  const atEnd = index >= total;
  const shelfLabel = shelf === "work" ? settings?.navLabelWork || "Work" : "Series";

  return (
    <div className="book bk-series" data-book-view="series">
      {/* 押す場所で前後へ送るのはマウスの近道。キーボードと読み上げは下の帯の
          ボタン（← → Index Info）と矢印キーで同じことができる。 */}
      <div
        className="bk-stage"
        role="presentation"
        onClick={onStageClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        data-at-start={index === 0 ? "" : undefined}
        data-at-end={atEnd ? "" : undefined}
      >
        {total === 0 && <p className="bk-empty font-ja">この作品にはまだ写真がありません</p>}
        {under && under.join("-") !== groupKey && (
          <div className="bk-stage__layer bk-stage__layer--under" data-spread={under.length > 1 ? "" : undefined} aria-hidden="true">
            {under.map((i) => (photos[i] ? <StagePhoto key={photos[i]!.id} photo={photos[i]!} alt="" hidden /> : null))}
          </div>
        )}
        {group.length > 0 && (
          <div
            key={groupKey}
            className="bk-stage__layer"
            data-spread={group.length > 1 ? "" : undefined}
            id={pageHash(group[0]!)}
            data-book-page=""
            data-book-num={`${counterText(group)} / ${pad2(total)}`}
          >
            {group.map((i) => (
              <span key={photos[i]!.id} className="bk-stage__page" data-photo-tile={photos[i]!.id}>
                <StagePhoto photo={photos[i]!} alt={alt(photos[i]!)} />
              </span>
            ))}
          </div>
        )}
        {/* 前後の組を先に読んでおく（送ったとき待たせない）。 */}
        {[groups[g + 1], g > 0 ? groups[g - 1] : undefined].map((grp) =>
          grp ? (
            <div key={`pre-${grp.join("-")}`} className="bk-stage__preload" data-spread={grp.length > 1 ? "" : undefined} aria-hidden="true">
              {grp.map((i) => (
                <StagePhoto key={photos[i]!.id} photo={photos[i]!} alt="" hidden />
              ))}
            </div>
          ) : null,
        )}
        {atEnd && total > 0 && (
          <section className="bk-colophon" aria-label="奥付">
            <p className="bk-colophon__kicker font-en">{shelfLabel}</p>
            <p className="bk-colophon__title font-ja">{series.title}</p>
            <FactLines facts={facts} />
            <nav className="bk-colophon__next" aria-label="次に見る">
              {nextChapter && (
                <Link to={`/${shelf}/${nextChapter.slug}`} className="bk-colophon__row">
                  <span className="font-ja">次の作品</span>
                  <span className="font-ja">{nextChapter.title} →</span>
                </Link>
              )}
              <button type="button" className="bk-colophon__row" onClick={() => setIndex(0)}>
                <span className="font-ja">はじめから</span>
                <span className="font-en">01 / {pad2(total)} →</span>
              </button>
              <Link to="/series" className="bk-colophon__row">
                <span className="font-en">Works</span>
                <span className="font-ja">すべての作品 →</span>
              </Link>
              {consult && (
                <Link to={contactHrefForWork(series.slug)} className="bk-colophon__row">
                  <span className="font-ja">相談</span>
                  <span className="font-ja">この作品について相談する →</span>
                </Link>
              )}
            </nav>
          </section>
        )}
      </div>

      <div className="bk-bar">
        <div className="bk-bar__where">
          <Link to="/series" className="bk-bar__up font-en">
            Works
          </Link>
          <span aria-hidden="true" className="bk-bar__slash">
            /
          </span>
          <h1 className="bk-bar__title font-ja">{series.title}</h1>
        </div>
        <div className="bk-bar__ctrl font-en">
          <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="前の写真">
            ←
          </button>
          <span className="bk-bar__count" aria-live="polite">
            {atEnd ? "—" : counterText(group)} / {pad2(total)}
          </span>
          <button type="button" onClick={() => go(1)} disabled={atEnd} aria-label="次の写真">
            →
          </button>
          <button
            type="button"
            className="bk-bar__tab"
            aria-expanded={panel === "index"}
            onClick={() => setPanel(panel === "index" ? null : "index")}
          >
            Index
          </button>
          <button
            type="button"
            className="bk-bar__tab"
            aria-expanded={panel === "info"}
            onClick={() => setPanel(panel === "info" ? null : "info")}
          >
            Info
          </button>
        </div>
      </div>

      {panel === "index" && (
        <section className="bk-sheet" aria-label={`${series.title}のすべてのコマ`}>
          <div className="bk-sheet__head">
            <p className="font-ja">
              {series.title}
              <span className="bk-sheet__count font-en"> {total}</span>
            </p>
            <button type="button" className="font-en" onClick={() => setPanel(null)}>
              Close
            </button>
          </div>
          <div className="bk-sheet__runs">
            {mediumRuns(photos).map((run) => (
              <section key={run.start} className="book-run" data-medium={run.medium} aria-label={MEDIUM_LABEL[run.medium]}>
                <ol className="book-run__frames" start={run.start + 1}>
                  {run.photos.map((p, i) => {
                    const at = run.start + i;
                    return (
                      <li key={p.id} className="book-frame">
                        <a
                          href={`#${pageHash(at)}`}
                          className="book-frame__link"
                          aria-current={group.includes(at) ? "true" : undefined}
                          onClick={(e) => {
                            e.preventDefault();
                            setIndex(at);
                            setPanel(null);
                          }}
                          aria-label={`${pad2(at + 1)} ${alt(p)}`}
                        >
                          <img src={p.thumbUrl ?? p.url} alt="" loading="lazy" decoding="async" />
                          <span className="book-frame__num font-en">{pad2(at + 1)}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
          <p className="bk-sheet__note font-ja">
            黒い帯はフィルム、紙の上はデジタルで撮った写真。番号は作品の中の順番です。
          </p>
        </section>
      )}

      {panel === "info" && (
        <aside className="bk-info" aria-label={`${series.title}について`}>
          <button type="button" className="bk-info__close font-en" onClick={() => setPanel(null)}>
            Close
          </button>
          <p className="bk-info__kicker font-en">{shelfLabel}</p>
          <p className="bk-info__title font-ja">{series.title}</p>
          {series.subtitle && <p className="bk-info__sub font-en">{series.subtitle}</p>}
          {series.statement && <p className="bk-info__statement font-ja">{series.statement}</p>}
          <FactLines facts={facts} />
          {consult && (
            <p>
              <Link to={contactHrefForWork(series.slug)} className="bk-info__link font-ja">
                この作品について相談する →
              </Link>
            </p>
          )}
        </aside>
      )}
    </div>
  );
}
