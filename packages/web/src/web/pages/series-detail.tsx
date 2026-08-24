import { useQuery } from "@tanstack/react-query";
import { ContentStatus } from "../components/ContentStatus";
import { Link, useParams } from "wouter";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageTitle } from "../hooks/usePageTitle";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { PhotoGallery, type GalleryPhoto } from "../components/PhotoGallery";
import { InquiryCta } from "../components/InquiryCta";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { SeriesCover } from "../components/SeriesCover";
import { SeriesColophon } from "../components/SeriesColophon";

export default function SeriesDetailPage() {
  const params = useParams();
  const slug = params.slug ?? "";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["series", slug],
    // The ":slug" subtree of the typed client collapses under TS instantiation
    // limits (see lib/api.ts) — the response shape is annotated manually instead.
    queryFn: async (): Promise<{
      series: { id: number; slug: string; title: string; subtitle: string; statement: string; themeConfig?: string | null };
      photos: GalleryPhoto[];
    } | null> => {
      const res = await (api.series as Record<string, any>)[":slug"].$get({ param: { slug } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!slug,
  });

  // N: series pages get their own layout setting.
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  // Next-series navigation (wrap-around) — keeps an engaged viewer moving from
  // one body of work to the next instead of dead-ending at the foot of a page.
  const { data: seriesListData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const seriesList = seriesListData?.series ?? [];
  // The detail endpoint does not return the cover, but the list one does and
  // this page already fetches it for the next-series link. No new request.
  const coverSource = seriesList.find(
    (s: { slug: string }) => s.slug === slug,
  ) as
    | {
        coverUrl?: string | null;
        coverRotationDeg?: number | null;
        coverFocalX?: number | null;
        coverFocalY?: number | null;
      }
    | undefined;
  const hasCover = Boolean(coverSource?.coverUrl);
  const curIdx = seriesList.findIndex((s) => s.slug === slug);
  const nextSeries = seriesList.length > 1 && curIdx >= 0
    ? seriesList[(curIdx + 1) % seriesList.length]
    : null;

  usePageTitle(data?.series.title);

  const entranceRef = usePageEntrance([data]);
  // PhotoGallery tiles use fade-in-item (opacity:0 until visible). usePageEntrance
  // only watches .page-entrance, so we need a separate ref for the gallery area.
  const fadeRef = useScrollFadeIn([data?.photos, data?.series?.themeConfig, settings?.seriesLayout]);

  // While loading, render a quiet placeholder rather than a "not found" flash.
  if (isLoading) {
    return <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-32 min-h-[60vh]" aria-hidden="true" />;
  }

  // 取得そのものに失敗したときは「見つかりません」と言わない。この query は
  // **404 を null で返し、それ以外の失敗だけ投げる**ので、両者は区別できる。
  // 一緒くたにすると、サーバーが一度つまずいただけで「このシリーズは無い」と
  // 伝えてしまう（オーナーの方針: エラーなら再読み込みを出す）。
  if (isError) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-32 md:py-48 min-h-[50vh]">
        <ContentStatus
          state="error"
          error={error}
          onRetry={() => void refetch()}
        />
        <div className="text-center">
          <Link
            to="/series"
            className="inline-block mt-8 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300"
          >
            ← Series
          </Link>
        </div>
      </section>
    );
  }

  // 非公開・存在しない slug（404）→ 静かな not-found。真っ白にはしない。
  if (!data) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-32 md:py-48 text-center min-h-[50vh]">
        <p className="font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">
          シリーズが見つかりませんでした。
        </p>
        <Link
          to="/series"
          className="inline-block mt-8 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300"
        >
          ← Series
        </Link>
      </section>
    );
  }

  const { series } = data;

  // 機能9: シリーズ固有のthemeConfigを適用
  const themeConfig = (() => {
    try { return series.themeConfig ? (JSON.parse(series.themeConfig) as Record<string, string>) : {}; }
    catch { return {}; }
  })();
  const photoOrder =
    themeConfig.photoOrder && themeConfig.photoOrder !== "inherit" && themeConfig.photoOrder !== "manual_inherit"
      ? themeConfig.photoOrder
      : settings?.seriesSortOrder;
  const photos = sortPhotosBySetting(data.photos, photoOrder);
  const seriesBgColor = themeConfig.bgColor ?? null;
  const seriesLayout = themeConfig.layout || settings?.seriesLayout;

  return (
    <section
      className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(7rem*var(--spacing-page-top,1))] pb-16 md:pb-28 min-h-[60vh]"
      ref={entranceRef}
      style={seriesBgColor ? { backgroundColor: seriesBgColor } : undefined}
    >
      {/* 表紙があれば、そこで開く。無ければ従来どおり紙の上の題名。 */}
      <SeriesCover
        series={coverSource}
        title={series.title}
        subtitle={series.subtitle || undefined}
      />

      {!hasCover && (
        <header className="max-w-2xl mx-auto text-center mb-16 md:mb-24 page-entrance">
          <h1
            className="font-ja break-words"
            style={{ fontSize: "var(--heading-size, 1.6rem)", color: `rgba(var(--foreground-rgb),0.82)`, letterSpacing: "0.03em", lineHeight: "var(--section-leading, 1.3)" }}
          >
            {series.title}
          </h1>
          {series.subtitle && (
            <p
              className="mt-3 font-en text-xs tracking-[0.10em] uppercase break-words"
              style={{
                fontSize: "var(--section-label-size-eff, 0.75rem)",
                color: "var(--section-label-color)",
              }}
            >
              {series.subtitle}
            </p>
          )}
        </header>
      )}

      {/* 作家の言葉は表紙と写真のあいだの「間」。狭い版面でゆっくり読ませる。 */}
      {series.statement && (
        <p
          className={`max-w-2xl mx-auto font-ja whitespace-pre-line break-words ja-prose page-entrance ${
            hasCover ? "mb-16 md:mb-24 text-left" : "-mt-8 mb-16 md:mb-24 text-left md:text-center"
          }`}
          style={{ fontSize: "var(--body-size, 0.95rem)", lineHeight: "var(--body-leading, 1.9)", letterSpacing: "var(--body-tracking, 0.02em)", color: `rgba(var(--foreground-rgb),0.62)` }}
        >
          {series.statement}
        </p>
      )}

      <div ref={fadeRef}>
        {photos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-ja text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">このシリーズにはまだ写真がありません</p>
          </div>
        ) : (
          <PhotoGallery
            photos={photos}
            layoutType={seriesLayout}
            seriesName={data?.series.title}
          />
        )}
      </div>

      <SeriesColophon photos={photos} />

      <InquiryCta />

      <div className={`mt-20 md:mt-28 flex items-baseline ${nextSeries ? "justify-between" : "justify-center"}`}>
        <Link
          to="/series"
          className="shrink-0 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.65)] nav-link-luxury transition-colors duration-300"
        >
          ← Series
        </Link>
        {nextSeries && (
          <Link
            to={`/series/${nextSeries.slug}`}
            /* min-w-0: flex の子は内容より狭くならないので、これが無いと
               折り返せない長いシリーズ名で行ごと画面外へ出る（実測 320px で
               530px）。break-words だけでは足りない。 */
            className="min-w-0 text-right font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.65)] nav-link-luxury transition-colors duration-300"
          >
            <span className="block text-[0.6rem] uppercase tracking-[0.14em] text-[color:var(--text-quiet)] mb-1">Next</span>
            <span className="font-ja break-words">{nextSeries.title}</span> →
          </Link>
        )}
      </div>
    </section>
  );
}
