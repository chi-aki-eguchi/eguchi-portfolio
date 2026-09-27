import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ContentStatus } from "../components/ContentStatus";
import { Link, useParams, useRoute } from "wouter";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageTitle } from "../hooks/usePageTitle";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { PhotoGallery } from "../components/PhotoGallery";
import { useSeriesDetail } from "../hooks/useSeriesDetail";
import { InquiryCta } from "../components/InquiryCta";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { SeriesCover } from "../components/SeriesCover";
import { SeriesColophon } from "../components/SeriesColophon";
import { seriesColophon } from "../lib/series-colophon";
import { signalAnalyticsPageReady } from "../lib/analytics";
import { contactHrefForWork } from "../../shared/contact-reference";
import { PhotoSeriesPage } from "../components/photo-site/PhotoSeries";
import { siteDesignFrom } from "../lib/book";

export default function SeriesDetailPage() {
  const params = useParams();
  const slug = params.slug ?? "";
  // 詳細が届く前・届かなかったときの棚は、実際に開いた経路で決める。
  // 同じ部品が `/series/:slug` と `/work/:slug` の両方を描くので、固定で
  // Series へ戻すと、Work の読み込み失敗や404からシリーズの棚へ飛ばしてしまう。
  const [onWorkRoute] = useRoute("/work/:slug");

  // Contact の「参考作品」と同じ鍵で引く（`hooks/useSeriesDetail.ts`）。
  const { data, isLoading, isError, error, refetch } = useSeriesDetail(slug);

  // N: series pages get their own layout setting.
  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  // Next-series navigation (wrap-around) — keeps an engaged viewer moving from
  // one body of work to the next instead of dead-ending at the foot of a page.
  // 棚（2026-08-30）。詳細の応答に `kind` が入っているので、それに従って
  // 「戻る先」と「次」を同じ棚の中で回す。**棚をまたいで次へ飛ばさない。**
  const shelf = data
    ? data.series.kind === "work" ? "work" : "series"
    : onWorkRoute ? "work" : "series";
  const { data: seriesListData } = useQuery({
    queryKey: shelf === "work" ? ["works"] : ["series"],
    queryFn: async () =>
      jsonOrThrow(
        await api.series.$get(
          shelf === "work" ? { query: { kind: "work" } } : {},
        ),
      ),
    // 棚が分かるまで（詳細が届くまで）は取りに行かない。先に取ると
    // シリーズ側を取ってしまい、Work の詳細で「次」が別の棚を指す。
    enabled: data != null,
  });
  const seriesList = seriesListData?.series ?? [];
  // The detail endpoint does not return the cover, but the list one does and
  // this page already fetches it for the next-series link. No new request.
  const coverSource = seriesList.find(
    (s: { slug: string }) => s.slug === slug,
  ) as
    | {
        coverPhotoId?: number | null;
        coverUrl?: string | null;
        coverRotationDeg?: number | null;
        coverFocalX?: number | null;
        coverFocalY?: number | null;
      }
    | undefined;
  const curIdx = seriesList.findIndex((s) => s.slug === slug);
  const nextSeries = seriesList.length > 1 && curIdx >= 0
    ? seriesList[(curIdx + 1) % seriesList.length]
    : null;

  usePageTitle(data?.series.title);
  useEffect(() => {
    if (!data || (!settings && !settingsError)) return;
    const resolvedShelf = data.series.kind === "work" ? "work" : "series";
    const timer = window.setTimeout(
      () =>
        signalAnalyticsPageReady(
          `/${resolvedShelf}/${encodeURIComponent(data.series.slug)}`,
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [data, settings, settingsError]);

  const shelfHref = shelf === "work" ? "/work" : "/series";
  const shelfLabel = shelf === "work" ? (settings?.navLabelWork || "Work") : "Series";
  const shelfNoun = shelf === "work" ? "作品" : "シリーズ";
  const backToShelf = (
    <Link
      to={shelfHref}
      className="inline-block mt-8 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300"
    >
      ← {shelfLabel}
    </Link>
  );

  const entranceRef = usePageEntrance([data]);
  // PhotoGallery tiles use fade-in-item (opacity:0 until visible). usePageEntrance
  // only watches .page-entrance, so we need a separate ref for the gallery area.
  const fadeRef = useScrollFadeIn([data?.photos, data?.series?.themeConfig, settings?.seriesLayout]);

  // While loading, render a quiet placeholder rather than a "not found" flash.
  if (isLoading) {
    // 1画面ぶん場所を取る。60vh だと 900px の画面でフッターが y=596 に
    // 描かれ、中身が届いた瞬間に画面外へ飛ぶ（実測 CLS 0.142）。
    // key は本文の <section> と別の要素にするため。同じ要素が使い回されると、
    // 上余白 128px→9.6px の変化が「動きを減らす」設定の極短い transition に
    // 乗り、1フレーム遅れて題名と1枚目が 118px 跳ねる（実測 CLS 0.111、
    // 2026-09-15。表紙の見開きがある間は画面の下で起きていて目立たなかった）。
    return <section key="series-hold" className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-32 site-page-hold" aria-hidden="true" />;
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
        <div className="text-center">{backToShelf}</div>
      </section>
    );
  }

  // 非公開・存在しない slug（404）→ 静かな not-found。真っ白にはしない。
  if (!data) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-32 md:py-48 text-center min-h-[50vh]">
        <p className="font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">
          {shelfNoun}が見つかりませんでした。
        </p>
        {backToShelf}
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

  // 写真中心のサイト（siteDesign = "book"）。並び・棚・次のシリーズは上と同じ値を渡す。
  if (siteDesignFrom(settings?.siteDesign) === "book") {
    return (
      <PhotoSeriesPage
        key={series.slug}
        series={series}
        photos={photos}
        shelf={shelf}
        nextChapter={
          nextSeries && nextSeries.slug !== series.slug
            ? { slug: nextSeries.slug, title: nextSeries.title }
            : null
        }
        settings={settings}
      />
    );
  }
  const seriesBgColor = themeConfig.bgColor ?? null;
  const seriesLayout = themeConfig.layout || settings?.seriesLayout;

  // 表紙の見開きは「オーナーが選んだ表紙が、1枚目とは別の写真」のときだけ。
  // 一覧 API は表紙が未設定だと先頭の写真を代わりに返す（札を空にしないため）。
  // それを詳細でも見開きにすると、同じ写真が表紙と1枚目で2度続き、PCでは
  // 縦写真を横長に切った断片から始まっていた（/series/sicf、2026-09-15）。
  const coverUrl = coverSource?.coverUrl;
  const hasCover =
    coverSource?.coverPhotoId != null &&
    Boolean(coverUrl) &&
    coverUrl !== photos[0]?.url;
  // 紙の上の題名に、一覧の札と同じ「規模と時期」を添える。何点の組を
  // 見始めるのかが、写真の前に分かる。新しい通信はしない（手元の写真から数える）。
  const scale = hasCover ? null : seriesColophon(photos);
  const scaleLine = scale
    ? [`${scale.count}点`, scale.period].filter(Boolean).join(" ／ ")
    : "";
  const aboutLabel = settings?.navLabelAbout || "About";
  const photographerName = settings?.profileName || settings?.siteName || "";

  return (
    <section
      key="series-body"
      className="max-w-5xl mx-auto site-page site-page-top pb-8 md:pb-16 min-h-[60vh]"
      ref={entranceRef}
      style={seriesBgColor ? { backgroundColor: seriesBgColor } : undefined}
    >
      {/* 表紙があれば、そこで開く。無ければ従来どおり紙の上の題名。 */}
      <SeriesCover
        series={hasCover ? coverSource : undefined}
        title={series.title}
        subtitle={series.subtitle || undefined}
      />

      {!hasCover && (
        <header className="max-w-2xl mx-auto text-center mb-8 md:mb-12 page-entrance">
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
          {scaleLine && (
            <p className="series-scale mt-3 font-en">{scaleLine}</p>
          )}
        </header>
      )}

      {/* 作家の言葉は表紙と写真のあいだの「間」。狭い版面でゆっくり読ませる。
          大きさ・濃さ・行間は `.series-statement`（styles.css）に置いた。
          ここは唯一の「人が書いた文」なので、本文ではなく導入文として組む。 */}
      {series.statement && (
        <p
          className={`series-statement max-w-2xl mx-auto font-ja whitespace-pre-line break-words ja-prose page-entrance ${
            hasCover ? "mb-10 md:mb-16 text-left" : "-mt-4 mb-10 md:mb-16 text-left md:text-center"
          }`}
        >
          {series.statement}
        </p>
      )}

      {/* 長い作品は、最後まで読み切らないと相談へ着かない。実測（2026-09-19、
          390px の本番 /work/rintaro）で、本文中の問い合わせリンクはページ先頭から
          34,653px、ページ全体は 35,161px だった。**導入のすぐ下に、静かな一行を
          1本だけ置く。** 写真の上には何も重ねない。
          Series 棚には置かない——作品を見ている途中に同じ強さの営業導線を
          2つの棚へ出す理由が無い。見終わったあとの帯（InquiryCta）は今までどおり。
          CTA を切っているサイト（配布版の既定）では出ない。 */}
      {shelf === "work" && (settings?.homeCtaEnabled ?? "off") === "on" && (
        <p className="max-w-2xl mx-auto mb-10 md:mb-14 text-center page-entrance">
          <Link
            to={contactHrefForWork(series.slug)}
            className="inline-block font-ja text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300 py-1.5"
          >
            この作品について相談する →
          </Link>
        </p>
      )}

      <div ref={fadeRef}>
        {photos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-ja text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">この{shelfNoun}にはまだ写真がありません</p>
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

      {/* 見終わったあとの行き先。次の作品群があればそれを、なければ（あっても）
          撮った人のプロフィールを。以前は「← Series」と「Next」だけで、次が
          無い作品群では戻るしかなかった。見出しは小さな英字、行き先の名前は
          一覧の札と同じ濃さで読ませる。 */}
      <nav
        aria-label="次に見る"
        className="mt-10 md:mt-14 flex items-baseline justify-between gap-6"
      >
        <Link
          to={shelfHref}
          className="shrink-0 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.65)] nav-link-luxury transition-colors duration-300"
        >
          ← {shelfLabel}
        </Link>
        <div className="min-w-0 flex flex-col items-end gap-5 md:flex-row md:items-baseline md:gap-12">
          {nextSeries && (
            <Link
              to={`/${shelf}/${nextSeries.slug}`}
              /* min-w-0: flex の子は内容より狭くならないので、これが無いと
                 折り返せない長いシリーズ名で行ごと画面外へ出る（実測 320px で
                 530px）。break-words だけでは足りない。 */
              className="series-onward min-w-0 max-w-full text-right nav-link-luxury"
            >
              <span className="series-onward__label font-en">Next</span>
              <span className="series-onward__name font-ja break-words">{nextSeries.title} →</span>
            </Link>
          )}
          <Link
            to="/about"
            className="series-onward min-w-0 max-w-full text-right nav-link-luxury"
          >
            {photographerName && (
              <span className="series-onward__label font-en">{aboutLabel}</span>
            )}
            <span className="series-onward__name font-ja break-words">
              {photographerName || aboutLabel} →
            </span>
          </Link>
        </div>
      </nav>
    </section>
  );
}
