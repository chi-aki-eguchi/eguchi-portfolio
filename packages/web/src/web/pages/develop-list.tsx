import { useMemo, type CSSProperties } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { clampSetting } from "../../shared/setting-ranges";
import { num } from "../lib/utils";
import { galleryExcludesSeries } from "../lib/book";
import { galleryHasPhotos } from "../lib/work-entries";
import { ContentStatus } from "../components/ContentStatus";
import { InquiryCta } from "../components/InquiryCta";
import { PageTitle } from "../components/PageTitle";
import { Picture } from "../components/Picture";
import type { GalleryPhoto } from "../components/PhotoGallery";
import { PhotoStream } from "../components/photo-site/PhotoStream";
import { useSeriesLinks } from "../hooks/useSeriesLinks";
import { developDoorCopy, developListPhotos, type DevelopListKind } from "../../shared/develop-structure";
import { photoAltText } from "../../shared/photo-alt";
import { entranceCover, isRintaroEntrance } from "../lib/rintaro-entrance";
import "../components/develop/develop.css";

/*
 * 表紙1枚を入口にする撮影（akieguchi.com の Portrait だけ、2026-11-19）。
 *
 * オーナーの方針:「Rintaro の入口は1枚だけ。気になって開いた人は全部を見られる」。
 * どの撮影が対象か・表紙がどの1枚かは、Works と同じ `lib/rintaro-entrance.ts` に任せる
 * （Works と Portrait で表紙が食い違わないように。ここには写真の番号を書かない）。
 * ほかの撮影と、ほかの持ち主のサイトは今までどおり名前の一覧のまま。
 */

/** 表紙の縦横比（横 ÷ 縦。回した写真は入れ替える）。寸法が無い古い写真は、届いた画像の比に任せる。 */
function coverRatio(work: {
  coverWidth?: number | null;
  coverHeight?: number | null;
  coverRotationDeg?: number | null;
}): number | undefined {
  if (!work.coverWidth || !work.coverHeight) return undefined;
  const turned = Math.abs(work.coverRotationDeg ?? 0) % 180 === 90;
  return turned ? work.coverHeight / work.coverWidth : work.coverWidth / work.coverHeight;
}

/** 表紙の箱に渡す比。CSS は `--dv-cover-ar` で「1画面に収まる幅」を計算する。 */
function coverBoxStyle(ratio: number | undefined): CSSProperties | undefined {
  if (!ratio) return undefined;
  return { aspectRatio: ratio, "--dv-cover-ar": ratio } as CSSProperties;
}

/** その写真が、この作品に入っているか（写真は複数の作品に入れられる）。 */
function photoInWork(photo: GalleryPhoto, workId: number): boolean {
  return photo.seriesIds ? photo.seriesIds.includes(workId) : photo.seriesId === workId;
}

/** 写真の並びの名前（読み上げ用）。ページの見出しは扉の名前（設定 developDoors）から。 */
const STREAM_LABEL: Record<DevelopListKind, string> = {
  portrait: "人を撮った写真",
  life: "日常の写真",
};

/**
 * 新しい構成の Portrait／Life（2026-10-10）。
 *
 * 写真は、選んだ物があればその順で、無ければ分類から出す（`shared/develop-structure.ts`）。段組みとビューアは
 * 写真中心のサイト用に作った部品（PhotoStream）を使う：元の縦横比のまま、切り抜かず、
 * どの段も横幅いっぱい（`showcaseOptionsFor`）。スマホでは画面の端から端まで。押すといつものビューアが開く。
 */
export default function DevelopListPage({ kind }: { kind: DevelopListKind }) {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  // 撮影ごとの実例（Work）は Portrait の続きに置く。
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
    enabled: kind === "portrait",
  });
  const { data: photoCounts } = useQuery({
    queryKey: ["photo-availability"],
    queryFn: async (): Promise<{ total: number; standalone: number }> =>
      jsonOrThrow(await api.photos.availability.$get()),
    staleTime: 60_000,
  });
  const seriesLinkById = useSeriesLinks();
  const photos = useMemo(
    () =>
      developListPhotos(
        kind,
        // 並びは管理画面で決めた順。Gallery を「ランダム」にしていても、ここは開くたびに変えない
        // （見せたい順に選ぶページなので。2026-10-11、本番は Gallery がランダムで毎回並びが変わっていた）。
        sortPhotosBySetting(photosQ.data?.photos ?? [], "manual") as GalleryPhoto[],
        // 選んだ写真があれば、その写真を選んだ順で（無ければ分類から）。
        kind === "portrait" ? settings?.developPortraitIds : settings?.developLifeIds,
      ),
    [kind, photosQ.data, settings?.developPortraitIds, settings?.developLifeIds],
  );
  const photographerName = settings?.siteName || settings?.siteNameEn || settings?.profileName || "";
  const works = kind === "portrait" ? (worksQ.data?.series ?? []) : [];
  const entranceWork = works.find((w) => isRintaroEntrance(w.slug, settings?.siteUrl));
  const coverWork = useMemo(() => {
    if (!entranceWork) return undefined;
    const work = entranceCover(entranceWork, photosQ.data?.photos ?? [], settings?.siteUrl);
    // 表紙が無い（写真がまだ無い）ときは、今までどおり名前の一覧に残す。
    return work.coverUrl ? work : undefined;
  }, [entranceWork, photosQ.data, settings?.siteUrl]);
  const listedWorks = coverWork ? works.filter((w) => w.id !== coverWork.id) : works;
  const coverWorkId = coverWork?.id;
  // 表紙で入口を作った作品の写真は、上の写真の並びから外す（入口は表紙の1枚だけにする）。
  // 外すのはその作品の分だけ。ほかの撮影の写真と並び順は変えない。
  const streamPhotos = useMemo(
    () => (coverWorkId == null ? photos : photos.filter((photo) => !photoInWork(photo, coverWorkId))),
    [photos, coverWorkId],
  );
  const showGallery = galleryHasPhotos(photoCounts, galleryExcludesSeries(settings));
  const title = developDoorCopy(settings?.developDoors)[kind].label;
  const label = STREAM_LABEL[kind];

  const foot = (
    <div className="dv-list__foot">
      {works.length > 0 && (
        <section className="dv-sessions" aria-label="撮影ごとの実例">
          <h2 className="dv-sessions__title">撮影ごとの実例</h2>
          {coverWork?.coverUrl && (
            <Link to={`/work/${coverWork.slug}`} className="dv-session-cover" data-session-cover={coverWork.slug}>
              <span className="dv-session-cover__photo" style={coverBoxStyle(coverRatio(coverWork))}>
                <Picture
                  url={coverWork.coverUrl}
                  width={coverWork.coverWidth}
                  height={coverWork.coverHeight}
                  rotationDeg={coverWork.coverRotationDeg}
                  alt={photoAltText({}, { photographerName, seriesName: coverWork.title })}
                  preset="grid"
                  sizes="(min-width: 768px) 48vw, 100vw"
                  fallbackW={1400}
                  fallbackQ={80}
                  className="dv-session-cover__img"
                  loading="lazy"
                  draggable={false}
                />
              </span>
              <span className="dv-session-cover__name">
                <span className="dv-session-cover__title font-en">{coverWork.title}</span>
                <span className="dv-session-cover__arrow font-en" aria-hidden="true">
                  →
                </span>
              </span>
            </Link>
          )}
          {listedWorks.length > 0 && (
            <ul>
              {listedWorks.map((w) => (
                <li key={w.id}>
                  <Link to={`/work/${w.slug}`} className="font-en">
                    {w.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {showGallery && (
        <p className="dv-archive">
          <Link to="/gallery" className="dv-archive__link">
            <span className="font-en">{settings?.navLabelGallery || "Gallery"}</span>
            <span className="dv-archive__arrow font-en" aria-hidden="true">
              →
            </span>
          </Link>
        </p>
      )}
      <InquiryCta />
    </div>
  );

  return (
    <section className="dv-list site-page site-page-top min-h-[60vh]" data-kind={kind}>
      {/* 見出しを出さない設定（hidden）のときは、場所も取らない（空の箱を置くと、写真の上に謎の余白が残る）。 */}
      <PageTitle className="dv-list__title" revealClass="">
        {title}
      </PageTitle>
      {photosQ.isLoading && <ContentStatus state="loading" />}
      {photosQ.isError && (
        <ContentStatus state="error" error={photosQ.error} onRetry={() => void photosQ.refetch()} />
      )}
      {photosQ.data && streamPhotos.length === 0 && (
        <>
          {/* 並びが空でも、表紙の入口があるなら「まだ写真がありません」とは言わない。 */}
          {!coverWork && <p className="ps-empty">まだ写真がありません。</p>}
          {foot}
        </>
      )}
      {streamPhotos.length > 0 && (
        <PhotoStream
          photos={streamPhotos}
          photographerName={photographerName}
          seriesLinkById={seriesLinkById}
          label={label}
          presentation="showcase"
          gapScale={clampSetting("galleryGapScale", num(settings?.galleryGapScale, 1))}
          after={foot}
        />
      )}
    </section>
  );
}
