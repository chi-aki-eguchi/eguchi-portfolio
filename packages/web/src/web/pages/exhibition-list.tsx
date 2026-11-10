import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { Picture } from "../components/Picture";
import type { GalleryPhoto } from "../components/PhotoGallery";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { orientedDimensions } from "../../shared/image-url";
import { photoAltText } from "../../shared/photo-alt";
import { exhibitionNeedsLibrary } from "../../shared/exhibition";
import {
  EXHIBITION_NAV_LABEL,
  exhibitionDisplayTitle,
  exhibitionEntryPhotos,
  exhibitionPath,
  publicExhibitions,
} from "../../shared/exhibitions";
import "../components/develop/exhibition.css";

/**
 * 展示の一覧（2026-11-10、shared/exhibitions.ts）。新しい順に、1件を写真1枚と題・会期で置く。
 * 写真は切り抜かない。押すと、その展示のページ（会場と同じ順の写真と、添えた文）へ。
 */
export default function ExhibitionListPage() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const shows = useMemo(() => publicExhibitions(settings, window.location.hostname), [settings]);
  const needsLibrary = shows.some((show) => exhibitionNeedsLibrary(show.photoIds));
  const { data: photosData } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
    enabled: needsLibrary,
  });
  const entranceRef = usePageEntrance([shows.length, photosData]);
  const photographerName = settings?.siteName ?? undefined;
  return (
    <section className="max-w-5xl mx-auto site-page site-page-top pb-16 md:pb-32 min-h-[60vh]" ref={entranceRef}>
      <PageTitle className="mb-8 md:mb-12">{EXHIBITION_NAV_LABEL}</PageTitle>
      <ol className="ex-index">
        {shows.map((show) => {
          const cover = exhibitionEntryPhotos(show, (photosData?.photos ?? []) as GalleryPhoto[])[0];
          const size = orientedDimensions(cover?.width, cover?.height, (cover as GalleryPhoto | undefined)?.rotationDeg);
          return (
            <li key={show.slug} className="ex-index__item page-entrance">
              <Link to={exhibitionPath(show.slug)} className="ex-index__link">
                <span
                  className="ex-index__photo"
                  style={
                    size.width && size.height
                      ? ({ "--ex-ar": String(size.width / size.height) } as React.CSSProperties)
                      : undefined
                  }
                >
                  {cover && (
                    <Picture
                      url={cover.url}
                      thumbUrl={(cover as GalleryPhoto).thumbUrl}
                      mediumUrl={(cover as GalleryPhoto).mediumUrl}
                      width={cover.width}
                      height={cover.height}
                      rotationDeg={(cover as GalleryPhoto).rotationDeg}
                      alt={photoAltText(cover, { photographerName })}
                      preset="grid"
                      sizes="(min-width: 768px) 46vw, 100vw"
                      fallbackW={1200}
                      fallbackQ={84}
                      className="ex-index__img"
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                </span>
                <span className="ex-index__text">
                  <span className="ex-index__title font-ja">{exhibitionDisplayTitle(show)}</span>
                  {show.title && show.dates && <span className="ex-index__dates font-ja">{show.dates}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
