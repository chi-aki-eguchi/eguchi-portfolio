import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import { Picture } from "../Picture";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { bookFacts } from "../../lib/book";
import { seriesHref } from "../../lib/series-links";
import { formatPeriodRange } from "../../lib/series-colophon";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { aspectOf, leadCount } from "../../lib/photo-rows";
import { PhotoStream } from "./PhotoStream";
import { PhotoInquiry } from "./PhotoTop";

type Settings = Record<string, string | null | undefined> | undefined;

type SeriesRow = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string | null;
  kind?: string | null;
  coverPhotoId?: number | null;
  photoCount?: number;
  shotAtFirst?: string | null;
  shotAtLast?: string | null;
};

/** 一覧の札に並べる数枚（表紙を先頭に、そのシリーズの写真から）。 */
export function stripFor(series: SeriesRow, photos: GalleryPhoto[], count = 5): GalleryPhoto[] {
  const members = photos.filter(
    (p) => p.seriesIds?.includes(series.id) ?? p.seriesId === series.id,
  );
  const cover = members.find((p) => p.id === series.coverPhotoId);
  return (cover ? [cover, ...members.filter((p) => p !== cover)] : members).slice(0, count);
}

function periodOf(s: SeriesRow): string {
  return formatPeriodRange(s.shotAtFirst ?? null, s.shotAtLast ?? null) ?? "";
}

/** 一覧の1段の狙いの高さ（px）。幅から決める。 */
function stripHeightFor(width: number): number {
  return width < 640 ? width * 0.62 : Math.min(340, Math.max(200, width * 0.2));
}

function SeriesEntry({ series, photos, width }: { series: SeriesRow; photos: GalleryPhoto[]; width: number }) {
  const candidates = stripFor(series, photos, 6);
  const period = periodOf(series);
  const ratios = candidates.map((p) => {
    const d = orientedDimensions(p.width, p.height, p.rotationDeg);
    return aspectOf(d.width, d.height);
  });
  // 題名の下に、写真を横幅いっぱいの1段で（元の比のまま、切り抜かない）。
  // 何枚並べるかは、狙いの高さに近くなる枚数（縦の写真が多いシリーズは少なく、横は多く）。
  const gap = width < 640 ? 4 : 6;
  const count =
    width > 0 && ratios.length > 0
      ? leadCount(ratios, width, gap, { height: stripHeightFor(width), maxCount: width < 640 ? 2 : 5 })
      : Math.min(candidates.length, width < 640 ? 2 : 4);
  const strip = candidates.slice(0, count);
  return (
    <li className="ps-series-entry">
      <Link to={seriesHref(series)} className="ps-series-entry__link">
        <span className="ps-series-entry__head">
          <span className="ps-series-entry__text">
            <span className="ps-series-entry__title">{series.title}</span>
            {series.subtitle && <span className="ps-series-entry__sub">{series.subtitle}</span>}
          </span>
          {period && <span className="ps-series-entry__facts font-en">{period}</span>}
        </span>
        {strip.length > 0 && (
          <span className="ps-series-entry__strip" aria-hidden="true" style={{ gap }}>
            {strip.map((p, i) => (
              <span
                key={p.id}
                className="ps-series-entry__frame"
                style={{ flexGrow: ratios[i], aspectRatio: String(ratios[i]) }}
              >
                <Picture
                  url={p.url}
                  thumbUrl={p.thumbUrl}
                  mediumUrl={p.mediumUrl}
                  width={p.width}
                  height={p.height}
                  rotationDeg={p.rotationDeg}
                  alt=""
                  preset="lightbox"
                  sizes={width < 640 ? "50vw" : "25vw"}
                  fallbackW={900}
                  fallbackQ={80}
                  loading="lazy"
                  draggable={false}
                />
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * シリーズの一覧（写真中心のサイト、2026-09-26）。
 *
 * 主役は写真の一覧（トップ）なので、ここは題名で読む目次にする。各行に数枚の
 * 写真を元の比のまま小さく添える。Series と Work（呼び方は設定）の2つの棚。
 */
export function PhotoSeriesIndex({ settings }: { settings: Settings }) {
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const photos = (photosQ.data?.photos ?? []) as GalleryPhoto[];
  const series = (seriesQ.data?.series ?? []) as SeriesRow[];
  const works = (worksQ.data?.series ?? []) as SeriesRow[];
  const workLabel = settings?.navLabelWork || "Work";
  const groups = [
    { label: "Series", rows: series },
    { label: workLabel, rows: works },
  ].filter((g) => g.rows.length > 0);
  const loading = seriesQ.isLoading || worksQ.isLoading;
  const failed = seriesQ.isError || worksQ.isError;
  // 札の写真の段は、一覧の幅から組む（どの札も同じ幅）。
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ps-page ps-series-index" ref={listRef}>
      <header className="ps-page-head">
        <h1 className="ps-page-head__title font-en">Series</h1>
      </header>
      {loading && <ContentStatus state="loading" />}
      {failed && (
        <ContentStatus
          state="error"
          onRetry={() => {
            void seriesQ.refetch();
            void worksQ.refetch();
          }}
        />
      )}
      {!loading && !failed && groups.length === 0 && (
        <p className="ps-empty">
          まだシリーズがありません。<Link to="/">写真を見る</Link>
        </p>
      )}
      {groups.map((g) => (
        <section key={g.label} className="ps-series-group" aria-label={g.label}>
          {/* 見出しの「Series」と同じ名前の最初の棚には、見出しを重ねない。 */}
          {groups.length > 1 && g.label !== "Series" && (
            <h2 className="ps-series-group__label font-en">{g.label}</h2>
          )}
          <ol className="ps-series-list">
            {g.rows.map((s) => (
              <SeriesEntry key={s.id} series={s} photos={photos} width={width} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * シリーズ1本のページ。題名・言葉・事実のあとに、写真を段で並べる。
 * 最後に次のシリーズへ。
 */
export function PhotoSeriesPage({
  series,
  photos,
  shelf,
  nextChapter,
  settings,
}: {
  series: { id: number; slug: string; title: string; subtitle?: string | null; statement?: string | null };
  photos: GalleryPhoto[];
  shelf: "series" | "work";
  nextChapter: { slug: string; title: string } | null;
  settings: Settings;
}) {
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const seriesLinkById = useSeriesLinks();
  const facts = useMemo(() => bookFacts(photos), [photos]);
  const shelfLabel = shelf === "work" ? settings?.navLabelWork || "Work" : "Series";
  const period = facts.digitalPeriod;
  // 媒体は言葉だけ（枚数は出さない）。「フィルム」「デジタル」「フィルムとデジタル」。
  const medium =
    facts.film > 0 && facts.digital > 0
      ? "フィルムとデジタル"
      : facts.film > 0
        ? "フィルム"
        : facts.digital > 0
          ? "デジタル"
          : "";
  return (
    <div className="ps-page ps-series-page">
      <header className="ps-series-head">
        <Link to="/series" className="ps-series-head__up font-en">
          {shelfLabel}
        </Link>
        <h1 className="ps-series-head__title">{series.title}</h1>
        {series.subtitle && <p className="ps-series-head__sub">{series.subtitle}</p>}
        {photos.length > 0 && (period || medium) && (
          <p className="ps-series-head__facts">
            {period && <span className="font-en">{period}</span>}
            {medium && <span>{medium}</span>}
          </p>
        )}
        {series.statement && <p className="ps-series-head__statement">{series.statement}</p>}
      </header>
      {photos.length === 0 ? (
        <p className="ps-empty">このシリーズには、まだ公開している写真がありません。</p>
      ) : (
        <PhotoStream
          photos={photos}
          photographerName={photographerName}
          seriesLinkById={seriesLinkById}
          seriesName={series.title}
          label={series.title}
        />
      )}
      <PhotoInquiry settings={settings} />
      <nav className="ps-series-foot" aria-label="ほかのシリーズ">
        {nextChapter && (
          <Link
            to={seriesHref({ slug: nextChapter.slug, kind: shelf })}
            className="ps-series-foot__next"
          >
            <span className="ps-series-foot__label">次のシリーズ</span>
            <span className="ps-series-foot__title">{nextChapter.title}</span>
          </Link>
        )}
        <Link to="/series" className="ps-series-foot__all">
          シリーズの一覧
        </Link>
      </nav>
    </div>
  );
}
