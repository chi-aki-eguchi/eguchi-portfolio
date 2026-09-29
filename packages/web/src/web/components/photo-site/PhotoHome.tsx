import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { PhotoStream } from "./PhotoStream";
import { TopEntrances, TopName } from "./PhotoTop";

type Settings = Record<string, string | null | undefined> | undefined;

/** 選択した公開写真だけを、選択順のまま表示。未選択の場合だけ先頭1枚を表紙にする。 */
export function topPhotosFor(all: GalleryPhoto[], picked: Pick<GalleryPhoto, "id">[]): GalleryPhoto[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const chosen = [...new Set(picked.map((p) => p.id))]
    .map((id) => byId.get(id))
    .filter((p): p is GalleryPhoto => Boolean(p));
  return chosen.length ? chosen : all.slice(0, 1);
}

/** トップの形（管理画面「トップの形」）。cover-selection: 表紙と選んだ写真 ／ cover-only: 表紙だけ。 */
export function topLayoutFrom(value: string | null | undefined): "cover-selection" | "cover-only" {
  return value === "cover-only" ? "cover-only" : "cover-selection";
}

/** トップの言葉（プロフィールの文章）。段落ごとに。空なら出さない。 */
function HomeStatement({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <section className="ps-statement" aria-label="言葉">
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </section>
  );
}

/** 表紙の段の下に取っておく余白（px）。段の下端が画面の下にぴったり付かないように。 */
const COVER_BREATH = 28;

/**
 * 写真中心のサイトのトップ（2026-09-26 作り直し）。
 *
 * 名前の帯 → 表紙1枚（元の比で画面の残りの高さに収める）→ 選んだ写真の
 * 続き → すべての写真（Gallery）と Series への入口。全部の写真は Gallery のページ。
 * 「表紙だけ」にすると、表紙の段で終わる。
 */
export function PhotoHome({
  settings,
  leadPhotos,
}: {
  settings: Settings;
  leadPhotos: GalleryPhoto[];
}) {
  const name = settings?.siteName || settings?.siteNameEn || settings?.profileName || "Photographs";
  const photographerName = settings?.siteName || settings?.siteNameEn || settings?.profileName || "";
  const layout = topLayoutFrom(settings?.photoTopLayout);

  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const seriesLinkById = useSeriesLinks();
  // Series の入口は、公開しているシリーズか作品があるときだけ。
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const showSeries =
    (seriesQ.data?.series?.length ?? 0) > 0 || (worksQ.data?.series?.length ?? 0) > 0;
  const all = useMemo(() => (photosQ.data?.photos ?? []) as GalleryPhoto[], [photosQ.data]);
  const photos = useMemo(() => topPhotosFor(all, leadPhotos), [all, leadPhotos]);

  // 表紙の段の高さ = 画面の高さ − 名前の帯（と「トップの言葉」）の下端まで − 息をつく余白。
  // 下端は、描いた後に測る（文字の大きさは管理画面の設定で変わる）。
  const headRef = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(220);
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const measure = () => {
      const bottom = el.getBoundingClientRect().bottom + window.scrollY;
      setReserve(Math.round(bottom + COVER_BREATH));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statementAt = settings?.homeStatement ?? "off";
  const statement = settings?.profileStatement ?? "";

  return (
    <div className="ps-page ps-home" data-layout={layout}>
      <div ref={headRef} className="ps-home__head">
        <TopName name={name} nameEn={settings?.siteNameEn} subtitle={settings?.heroSubtitle} />
        {statementAt === "before-works" && <HomeStatement text={statement} />}
      </div>
      {photosQ.isLoading && <ContentStatus state="loading" />}
      {photosQ.isError && (
        <ContentStatus state="error" error={photosQ.error} onRetry={() => void photosQ.refetch()} />
      )}
      {photosQ.data && photos.length === 0 && <p className="ps-empty">まだ写真がありません。</p>}
      {photos.length > 0 && (
        <PhotoStream
          photos={photos}
          photographerName={photographerName}
          seriesLinkById={seriesLinkById}
          label="トップの写真"
          presentation="selection"
          lead={{ reserve }}
          maxRows={layout === "cover-only" ? 1 : undefined}
          after={
            layout === "cover-only" ? (
              statementAt === "after-works" ? <HomeStatement text={statement} /> : undefined
            ) : (
              <>
                {statementAt === "after-works" && <HomeStatement text={statement} />}
                <TopEntrances
                  settings={settings}
                  showSeries={showSeries}
                  photoCount={all.length}
                  seriesCount={(seriesQ.data?.series?.length ?? 0) + (worksQ.data?.series?.length ?? 0)}
                />
              </>
            )
          }
        />
      )}
    </div>
  );
}
