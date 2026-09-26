import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import { Picture } from "../Picture";
import type { GalleryPhoto } from "../PhotoGallery";
import { orientedDimensions } from "../../../shared/image-url";
import { bookFacts, mediumLine } from "../../lib/book";
import { seriesHref } from "../../lib/series-links";
import { formatPeriodRange } from "../../lib/series-colophon";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { aspectOf } from "../../lib/photo-rows";
import { PhotoStream } from "./PhotoStream";

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

function SeriesEntry({ series, photos, index }: { series: SeriesRow; photos: GalleryPhoto[]; index: number }) {
  const strip = stripFor(series, photos);
  const period = periodOf(series);
  return (
    <li className="ps-series-entry">
      <Link to={seriesHref(series)} className="ps-series-entry__link">
        <span className="ps-series-entry__num font-en" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="ps-series-entry__text">
          <span className="ps-series-entry__title">{series.title}</span>
          {series.subtitle && <span className="ps-series-entry__sub">{series.subtitle}</span>}
        </span>
        <span className="ps-series-entry__facts font-en">
          {[period, series.photoCount ? `${series.photoCount}` : ""].filter(Boolean).join(" · ")}
          {series.photoCount ? <span className="font-ja">枚</span> : null}
        </span>
        {strip.length > 0 && (
          <span className="ps-series-entry__strip" aria-hidden="true">
            {strip.map((p) => {
              const d = orientedDimensions(p.width, p.height, p.rotationDeg);
              return (
                <span
                  key={p.id}
                  className="ps-series-entry__frame"
                  style={{ aspectRatio: String(aspectOf(d.width, d.height)) }}
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
                    sizes="240px"
                    fallbackW={600}
                    fallbackQ={78}
                    loading="lazy"
                    draggable={false}
                  />
                </span>
              );
            })}
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

  return (
    <div className="ps-page ps-series-index">
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
          {groups.length > 1 && <h2 className="ps-series-group__label font-en">{g.label}</h2>}
          <ol className="ps-series-list">
            {g.rows.map((s, i) => (
              <SeriesEntry key={s.id} series={s} photos={photos} index={i} />
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
  return (
    <div className="ps-page ps-series-page">
      <header className="ps-series-head">
        <Link to="/series" className="ps-series-head__up font-en">
          ← {shelfLabel}
        </Link>
        <h1 className="ps-series-head__title">{series.title}</h1>
        {series.subtitle && <p className="ps-series-head__sub">{series.subtitle}</p>}
        {photos.length > 0 && (
          <p className="ps-series-head__facts font-en">
            {facts.count}
            <span className="font-ja">枚</span>
            <span aria-hidden="true"> · </span>
            <span className="font-ja">{mediumLine(facts, "ja")}</span>
            {period && (
              <>
                <span aria-hidden="true"> · </span>
                {period}
              </>
            )}
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
      <nav className="ps-series-foot" aria-label="ほかのシリーズ">
        {nextChapter && (
          <Link
            to={seriesHref({ slug: nextChapter.slug, kind: shelf })}
            className="ps-series-foot__next"
          >
            <span className="font-en">Next</span>
            <span>{nextChapter.title} →</span>
          </Link>
        )}
        <Link to="/series" className="ps-series-foot__all font-en">
          All series
        </Link>
      </nav>
    </div>
  );
}
