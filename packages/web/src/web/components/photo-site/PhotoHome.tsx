import { useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { PhotoStream } from "./PhotoStream";
import { PhotoCover } from "./PhotoCover";

type Settings = Record<string, string | null | undefined> | undefined;
type Medium = "all" | "film" | "digital";

/**
 * 表紙に出す写真: 「トップの最初に並べる」で選んだ写真（公開中のもの、選んだ順）。
 * 選んでいなければ、サイトの並びの先頭の1枚。
 */
export function coverPhotosFor(all: GalleryPhoto[], lead: GalleryPhoto[]): GalleryPhoto[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const picked = lead.map((p) => byId.get(p.id)).filter((p): p is GalleryPhoto => Boolean(p));
  return picked.length > 0 ? picked : all.slice(0, 1);
}

/**
 * 表紙の下の一覧。絞り込んでいないときは、表紙の写真を外す（すぐ下に同じ写真が
 * 続かないように）。絞り込んだときは、当たる写真を全部出す。
 */
export function streamPhotosFor(
  all: GalleryPhoto[],
  cover: GalleryPhoto[],
  filtering: boolean,
): GalleryPhoto[] {
  if (filtering) return all;
  const onCover = new Set(cover.map((p) => p.id));
  return all.filter((p) => !onCover.has(p.id));
}

function mediumOf(p: GalleryPhoto): Medium {
  return p.filmType === "フィルム" ? "film" : p.filmType === "デジタル" ? "digital" : "all";
}

/**
 * 写真中心のサイトのトップ（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * 開いた瞬間から写真が並ぶ。シリーズに入っている写真も入っていない写真も、
 * 全部が同じ場所に並ぶ（オーナー: 本来はシリーズに入っていない写真のほうが多い）。
 * 絞り込みは上の1行だけ（分類・フィルム／デジタル、URL に残す）。
 */
export function PhotoHome({
  settings,
  leadPhotos,
}: {
  settings: Settings;
  leadPhotos: GalleryPhoto[];
}) {
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const category = params.get("c") || "all";
  const medium: Medium = (() => {
    const v = params.get("medium");
    return v === "film" || v === "digital" ? v : "all";
  })();

  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
    staleTime: 5 * 60_000,
  });
  const seriesLinkById = useSeriesLinks();

  // 写真の一覧は、サイトの並び順そのまま。「トップの最初に並べる」写真は表紙に出す。
  const all = useMemo(() => (photosQ.data?.photos ?? []) as GalleryPhoto[], [photosQ.data]);
  const coverPhotos = useMemo(() => coverPhotosFor(all, leadPhotos), [all, leadPhotos]);
  const usedCategories = useMemo(() => {
    const used = new Set(all.map((p) => p.category).filter(Boolean));
    return (catsData?.categories ?? []).filter((c) => used.has(c.slug));
  }, [all, catsData]);
  const hasMedium = all.some((p) => mediumOf(p) !== "all");
  const shown = useMemo(
    () =>
      streamPhotosFor(all, coverPhotos, category !== "all" || medium !== "all").filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (medium === "all" || mediumOf(p) === medium),
      ),
    [all, coverPhotos, category, medium],
  );

  const hrefWith = (next: { c?: string; medium?: Medium }) => {
    const q = new URLSearchParams(params);
    const put = (key: string, value: string | undefined) => {
      if (value === undefined) return;
      if (value === "all") q.delete(key);
      else q.set(key, value);
    };
    put("c", next.c);
    put("medium", next.medium);
    const qs = q.toString();
    return qs ? `${location}?${qs}` : location;
  };

  const filtering = category !== "all" || medium !== "all";

  return (
    <div className="ps-page ps-home">
      {coverPhotos.length > 0 ? (
        <PhotoCover
          photos={coverPhotos}
          name={settings?.siteName || photographerName}
          nameEn={settings?.siteNameEn}
          subtitle={settings?.heroSubtitle}
          total={all.length}
          photographerName={photographerName}
          streamId="photographs"
          seriesLinkById={seriesLinkById}
        />
      ) : (
        <h1 className="sr-only">{photographerName}</h1>
      )}
      <div id="photographs" className="ps-home__stream-start" />
      {(usedCategories.length > 0 || hasMedium) && (
        <nav className="ps-filters" aria-label="写真の絞り込み">
          <ul className="ps-filters__group">
            <li>
              <Link to={hrefWith({ c: "all" })} aria-current={category === "all" ? "true" : undefined}>
                All
              </Link>
            </li>
            {usedCategories.map((c) => (
              <li key={c.slug}>
                <Link to={hrefWith({ c: c.slug })} aria-current={category === c.slug ? "true" : undefined}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
          {hasMedium && (
            <ul className="ps-filters__group">
              <li>
                <Link to={hrefWith({ medium: "film" })} aria-current={medium === "film" ? "true" : undefined}>
                  Film
                </Link>
              </li>
              <li>
                <Link to={hrefWith({ medium: "digital" })} aria-current={medium === "digital" ? "true" : undefined}>
                  Digital
                </Link>
              </li>
            </ul>
          )}
          <p className="ps-filters__count font-en" aria-live="polite">
            {photosQ.data ? `${shown.length}` : ""}
          </p>
        </nav>
      )}

      {photosQ.isLoading && <ContentStatus state="loading" />}
      {photosQ.isError && (
        <ContentStatus state="error" error={photosQ.error} onRetry={() => void photosQ.refetch()} />
      )}
      {photosQ.data && shown.length === 0 && (
        <p className="ps-empty">
          {filtering ? (
            <>
              写真が見つかりませんでした。
              <button type="button" onClick={() => setLocation(hrefWith({ c: "all", medium: "all" }))}>
                すべての写真を見る
              </button>
            </>
          ) : (
            "まだ写真がありません。"
          )}
        </p>
      )}
      {shown.length > 0 && (
        <PhotoStream
          key={`${category}/${medium}`}
          photos={shown}
          photographerName={photographerName}
          seriesLinkById={seriesLinkById}
          label="写真"
        />
      )}
    </div>
  );
}
