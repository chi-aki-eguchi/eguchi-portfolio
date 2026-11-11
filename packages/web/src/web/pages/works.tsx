import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { Picture } from "../components/Picture";
import { JaPhrases } from "../components/JaPhrases";
import type { GalleryPhoto } from "../components/PhotoGallery";
import type { DevelopPhoto } from "../components/develop/DevelopHome";
import { api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { exhibitionNeedsLibrary } from "../../shared/exhibition";
import { photoAltText } from "../../shared/photo-alt";
import {
  DEVELOP_INQUIRY_HREF,
  developDoorCopy,
  developListPhotos,
  spreadOtherText,
  SPREAD_WORKS_LABEL,
} from "../../shared/develop-structure";
import {
  EXHIBITION_LIST_PATH,
  EXHIBITION_NAV_LABEL,
  exhibitionDisplayTitle,
  exhibitionEntryPhotos,
  publicExhibitions,
} from "../../shared/exhibitions";
import "../components/develop/spread.css";

type Row = {
  key: string;
  href: string;
  title: string;
  note: string;
  photo: DevelopPhoto | null;
  /** シリーズ・仕事の棚の表紙。写真の説明に棚の名前を添える。 */
  shelf?: boolean;
};

function ratio(photo: DevelopPhoto): string | undefined {
  if (!photo.width || !photo.height) return undefined;
  const turned = Math.abs(photo.rotationDeg ?? 0) % 180 === 90;
  return turned ? `${photo.height} / ${photo.width}` : `${photo.width} / ${photo.height}`;
}

/**
 * Works（/works、2026-11-10）。見開きのトップの右の頁の先：自分で撮りためた物をまとめた棚。
 * シリーズ（と単発の仕事）・展示・日常の写真を、表紙1枚と名前で順に置く。写真は切り抜かない。
 * 終わりに、人のほかの撮影（物撮りなど）の相談。日常の写真（Life）のページには依頼を出さない。
 */
export default function WorksPage() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const seriesQ = useQuery({ queryKey: ["series"], queryFn: async () => jsonOrThrow(await api.series.$get()) });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const photosQ = useQuery({ queryKey: ["photos"], queryFn: async () => jsonOrThrow(await api.photos.$get()) });
  const copy = developDoorCopy(settings?.developDoors);
  const photos = useMemo(
    () => sortPhotosBySetting(photosQ.data?.photos ?? [], "manual") as DevelopPhoto[],
    [photosQ.data],
  );
  const rows = useMemo<Row[]>(() => {
    const shelves = [
      ...(seriesQ.data?.series ?? []).map((s) => ({ ...s, href: `/series/${s.slug}` })),
      ...(worksQ.data?.series ?? []).map((s) => ({ ...s, href: `/work/${s.slug}` })),
    ];
    const list: Row[] = shelves.map((s) => ({
      key: s.href,
      href: s.href,
      title: s.title,
      shelf: true,
      note: s.photoCount > 0 ? `${s.photoCount}` : "",
      photo: s.coverUrl
        ? {
            url: s.coverUrl,
            width: s.coverWidth,
            height: s.coverHeight,
            rotationDeg: s.coverRotationDeg,
          }
        : null,
    }));
    const shows = publicExhibitions(settings, window.location.hostname);
    if (shows.length > 0) {
      const latest = shows[0]!;
      const library = exhibitionNeedsLibrary(latest.photoIds) ? ((photosQ.data?.photos ?? []) as GalleryPhoto[]) : [];
      const cover = exhibitionEntryPhotos(latest, library)[0] as DevelopPhoto | undefined;
      list.push({
        key: EXHIBITION_LIST_PATH,
        href: EXHIBITION_LIST_PATH,
        title: EXHIBITION_NAV_LABEL,
        note: shows.length === 1 ? exhibitionDisplayTitle(latest) : `${shows.length}`,
        photo: cover ?? null,
      });
    }
    const life = developListPhotos("life", photos, settings?.developLifeIds);
    if (life.length > 0)
      list.push({ key: "/life", href: "/life", title: copy.life.label, note: copy.life.note, photo: life[0] ?? null });
    return list;
  }, [seriesQ.data, worksQ.data, photosQ.data, photos, settings, copy.life.label, copy.life.note]);
  const other = settings?.homeCtaEnabled === "on" ? spreadOtherText(settings?.homeCtaOtherText) : "";
  const fadeRef = useScrollFadeIn([rows.length]);
  return (
    <section className="sp wk site-page site-page-top min-h-[60vh]" ref={fadeRef}>
      <PageTitle className="wk__title">{SPREAD_WORKS_LABEL}</PageTitle>
      <ol className="wk__list">
        {rows.map((row) => (
          <li key={row.key} className="wk__item">
            <Link to={row.href} className="wk__link">
              <span className="wk__photo fade-in-item" style={{ aspectRatio: row.photo ? ratio(row.photo) : undefined }}>
                {row.photo && (
                  <Picture
                    url={row.photo.url}
                    thumbUrl={row.photo.thumbUrl}
                    mediumUrl={row.photo.mediumUrl}
                    width={row.photo.width}
                    height={row.photo.height}
                    rotationDeg={row.photo.rotationDeg}
                    alt={photoAltText(row.photo, {
                      photographerName: settings?.siteName,
                      seriesName: row.shelf ? row.title : undefined,
                    })}
                    preset="grid"
                    sizes="(min-width: 768px) 48vw, 100vw"
                    fallbackW={1400}
                    fallbackQ={80}
                    className="wk__img"
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </span>
              <span className="wk__text">
                <span className="wk__name font-en">{row.title}</span>
                {row.note && <span className="wk__note">{row.note}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {other && (
        <p className="wk__other">
          <JaPhrases>{other}</JaPhrases>
          <Link to={DEVELOP_INQUIRY_HREF} className="sp-go">
            ご相談
            <span className="sp-go__arrow font-en" aria-hidden="true">
              →
            </span>
          </Link>
        </p>
      )}
    </section>
  );
}
