import { useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { PhotoStream } from "./PhotoStream";
import { PhotoInquiry } from "./PhotoTop";

type Settings = Record<string, string | null | undefined> | undefined;
type Medium = "all" | "film" | "digital";

export function mediumOf(p: Pick<GalleryPhoto, "filmType">): Medium {
  return p.filmType === "フィルム" ? "film" : p.filmType === "デジタル" ? "digital" : "all";
}

/**
 * すべての写真（写真中心のサイトの Gallery、2026-09-26）。
 *
 * トップは「表紙と選んだ写真」、ここは公開している写真を全部、サイトの並び順で。
 * シリーズに入っている写真も入っていない写真も同じ場所に並ぶ。
 * 絞り込みは上の1行だけ（分類・フィルム／デジタル、URL に残す）。中身の無い分類は出さない。
 */
export function PhotoAllPage({ settings }: { settings: Settings }) {
  const photographerName = settings?.siteName || settings?.siteNameEn || settings?.profileName || "";
  const title = settings?.navLabelGallery || "Gallery";
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

  const all = useMemo(() => (photosQ.data?.photos ?? []) as GalleryPhoto[], [photosQ.data]);
  const usedCategories = useMemo(() => {
    const used = new Set(all.map((p) => p.category).filter(Boolean));
    return (catsData?.categories ?? []).filter((c) => used.has(c.slug));
  }, [all, catsData]);
  const hasMedium = all.some((p) => mediumOf(p) !== "all");
  const shown = useMemo(
    () =>
      all.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (medium === "all" || mediumOf(p) === medium),
      ),
    [all, category, medium],
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
    <div className="ps-page ps-all">
      {/* header にしない: 全体の「header > nav」の余白（サイトの帯用）が絞り込みに付く。 */}
      <div className="ps-page-head ps-page-head--with-filters">
        <h1 className="ps-page-head__title font-en">{title}</h1>
        {(usedCategories.length > 0 || hasMedium) && (
          <nav className="ps-filters" aria-label="写真の絞り込み">
            <ul className="ps-filters__group">
              <li>
                <Link
                  to={hrefWith({ c: "all", medium: "all" })}
                  aria-current={!filtering ? "true" : undefined}
                >
                  {settings?.filterAllLabel || "All"}
                </Link>
              </li>
              {usedCategories.map((c) => (
                <li key={c.slug}>
                  <Link to={hrefWith({ c: c.slug })} aria-current={category === c.slug ? "true" : undefined}>
                    {c.label}
                  </Link>
                </li>
              ))}
              {hasMedium && (
                <>
                  <li>
                    <Link to={hrefWith({ medium: "film" })} aria-current={medium === "film" ? "true" : undefined}>
                      Film
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={hrefWith({ medium: "digital" })}
                      aria-current={medium === "digital" ? "true" : undefined}
                    >
                      Digital
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        )}
      </div>

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
          label="すべての写真"
          after={<PhotoInquiry settings={settings} />}
        />
      )}
    </div>
  );
}
