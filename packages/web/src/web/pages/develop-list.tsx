import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { galleryExcludesSeries } from "../lib/book";
import { galleryHasPhotos } from "../lib/work-entries";
import { ContentStatus } from "../components/ContentStatus";
import { InquiryCta } from "../components/InquiryCta";
import { PageTitle } from "../components/PageTitle";
import type { GalleryPhoto } from "../components/PhotoGallery";
import { PhotoStream } from "../components/photo-site/PhotoStream";
import { useSeriesLinks } from "../hooks/useSeriesLinks";
import { developListPhotos, type DevelopListKind } from "../../shared/develop-structure";
import "../components/develop/develop.css";

const COPY: Record<DevelopListKind, { title: string; label: string }> = {
  portrait: { title: "Portrait", label: "人を撮った写真" },
  life: { title: "Life", label: "日常の写真" },
};

/**
 * 新しい構成の Portrait／Life（2026-10-10）。
 *
 * 写真は、選んだ物があればその順で、無ければ分類から出す（`shared/develop-structure.ts`）。段組みとビューアは
 * 写真中心のサイト用に作った部品（PhotoStream）をそのまま使う：元の縦横比のまま、
 * 切り抜かず、押すといつものビューアが開く。
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
  const showGallery = galleryHasPhotos(photoCounts, galleryExcludesSeries(settings));
  const { title, label } = COPY[kind];

  const foot = (
    <div className="dv-list__foot">
      {works.length > 0 && (
        <section className="dv-sessions" aria-label="撮影ごとの実例">
          <h2 className="dv-sessions__title">撮影ごとの実例</h2>
          <ul>
            {works.map((w) => (
              <li key={w.id}>
                <Link to={`/work/${w.slug}`} className="font-en">
                  {w.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showGallery && (
        <p className="dv-archive">
          <Link to="/gallery" className="dv-archive__link">
            <span className="font-en">{settings?.navLabelGallery || "Gallery"}</span>
            <span className="dv-archive__note">すべての写真</span>
          </Link>
        </p>
      )}
      <InquiryCta />
    </div>
  );

  return (
    <section className="dv-list max-w-6xl mx-auto site-page site-page-top pb-16 md:pb-32 min-h-[60vh]" data-kind={kind}>
      <div className="ps-page-head dv-list__head" data-title-style={settings?.pageTitleStyle || "label"}>
        <PageTitle className="ps-page-head__title" revealClass="">
          {title}
        </PageTitle>
      </div>
      {photosQ.isLoading && <ContentStatus state="loading" />}
      {photosQ.isError && (
        <ContentStatus state="error" error={photosQ.error} onRetry={() => void photosQ.refetch()} />
      )}
      {photosQ.data && photos.length === 0 && (
        <>
          <p className="ps-empty">まだ写真がありません。</p>
          {foot}
        </>
      )}
      {photos.length > 0 && (
        <PhotoStream
          photos={photos}
          photographerName={photographerName}
          seriesLinkById={seriesLinkById}
          label={label}
          presentation="selection"
          after={foot}
        />
      )}
    </section>
  );
}
