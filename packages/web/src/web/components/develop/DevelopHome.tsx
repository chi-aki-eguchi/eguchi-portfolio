import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Picture } from "../Picture";
import { useScrollFadeIn } from "../../hooks/useScrollFadeIn";
import { DEVELOP_DOOR_NOTES, developListPhotos } from "../../../shared/develop-structure";
import "./develop.css";

type Settings = Record<string, string | null | undefined> | undefined;

export type DevelopPhoto = {
  id?: number;
  url: string;
  title?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  width?: number | null;
  height?: number | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  category?: string | null;
};

export type DevelopDoor = {
  key: "portrait" | "life" | "series" | "info";
  href: string;
  title: string;
  note: string;
  photo: DevelopPhoto | null;
};


const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 扉の並び。Series は公開しているシリーズか実例があるときだけ（メニューと同じ条件）。
 * それぞれの扉の写真は、その先のページの最初の1枚。
 */
export function developDoors({
  photos,
  seriesCover,
  profilePhoto,
  showSeries,
  picked,
}: {
  photos: DevelopPhoto[];
  seriesCover: DevelopPhoto | null;
  profilePhoto: DevelopPhoto | null;
  showSeries: boolean;
  /** Portrait／Life に選んだ写真（設定の文字列）。扉の写真は、その先のページの最初の1枚にする。 */
  picked?: { portrait?: string | null; life?: string | null };
}): DevelopDoor[] {
  const portrait = developListPhotos("portrait", photos, picked?.portrait);
  const life = developListPhotos("life", photos, picked?.life);
  return [
    { key: "portrait" as const, href: "/portrait", title: "Portrait", note: DEVELOP_DOOR_NOTES.portrait, photo: portrait[0] ?? null },
    { key: "life" as const, href: "/life", title: "Life", note: DEVELOP_DOOR_NOTES.life, photo: life[0] ?? null },
    ...(showSeries
      ? [{ key: "series" as const, href: "/series", title: "Series", note: DEVELOP_DOOR_NOTES.series, photo: seriesCover }]
      : []),
    { key: "info" as const, href: "/info", title: "Info", note: DEVELOP_DOOR_NOTES.info, photo: profilePhoto },
  ];
}

function position(photo: DevelopPhoto): string | undefined {
  if (photo.focalX == null && photo.focalY == null) return undefined;
  return `${photo.focalX ?? 50}% ${photo.focalY ?? 50}%`;
}

/**
 * 扉の目次。大きな言葉が入口で、触れた（または選んだ）扉の写真が隣に出る。
 * スマホでは隣に置く幅が無いので、扉ごとに写真を上に添える。
 */
function Doors({ doors }: { doors: DevelopDoor[] }) {
  const [active, setActive] = useState(0);
  const staged = doors.filter((d) => d.photo);
  // スマホの扉の写真は、画面に入ってきたときに現れる（今までの「写真が現れる」仕組みをそのまま使う）。
  const fadeRef = useScrollFadeIn([doors.length]);
  return (
    <section className="dv-doors" aria-label="目次" ref={fadeRef}>
      <ul className="dv-doors__list">
        {doors.map((door, i) => (
          <li key={door.key}>
            <Link
              to={door.href}
              className="dv-door"
              data-active={i === active ? "true" : undefined}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
            >
              {door.photo && (
                <span className="dv-door__photo fade-in-item">
                  <Picture
                    url={door.photo.url}
                    thumbUrl={door.photo.thumbUrl}
                    mediumUrl={door.photo.mediumUrl}
                    width={door.photo.width}
                    height={door.photo.height}
                    rotationDeg={door.photo.rotationDeg}
                    alt=""
                    preset="grid"
                    sizes="100vw"
                    fallbackW={1200}
                    fallbackQ={80}
                    className="dv-door__img"
                    style={{ objectPosition: position(door.photo) }}
                    loading="lazy"
                    draggable={false}
                  />
                </span>
              )}
              <span className="dv-door__no font-en">{pad(i + 1)}</span>
              <span className="dv-door__title font-en">{door.title}</span>
              <span className="dv-door__note">{door.note}</span>
            </Link>
          </li>
        ))}
      </ul>
      {staged.length > 0 && (
        <div className="dv-stage" aria-hidden="true">
          {doors.map((door, i) =>
            door.photo ? (
              <div key={door.key} className="dv-stage__photo" data-on={i === active ? "true" : undefined}>
                <Picture
                  url={door.photo.url}
                  thumbUrl={door.photo.thumbUrl}
                  mediumUrl={door.photo.mediumUrl}
                  width={door.photo.width}
                  height={door.photo.height}
                  rotationDeg={door.photo.rotationDeg}
                  alt=""
                  preset="grid"
                  sizes="(min-width: 768px) 34vw, 1px"
                  fallbackW={1200}
                  fallbackQ={80}
                  className="dv-stage__img"
                  style={{ objectPosition: position(door.photo) }}
                  loading="lazy"
                  draggable={false}
                />
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 新しい構成のトップ（siteDesign = "develop"、2026-10-10）。
 *
 * 表紙（「トップに出す」で選んだ写真）→ 扉の目次（Portrait／Life／Series／Info）→
 * すべての写真（Gallery）への入口 → 撮影依頼の案内。全部の写真は Gallery のページ。
 */
export function DevelopHome({
  settings,
  photos,
  seriesCover,
  showSeries,
  showGallery,
  after,
}: {
  settings: Settings;
  photos: DevelopPhoto[];
  seriesCover: DevelopPhoto | null;
  showSeries: boolean;
  showGallery: boolean;
  after?: React.ReactNode;
}) {
  const profilePhoto = useMemo<DevelopPhoto | null>(
    () => (settings?.profilePhotoUrl ? { url: settings.profilePhotoUrl } : null),
    [settings?.profilePhotoUrl],
  );
  const doors = useMemo(
    () =>
      developDoors({
        photos,
        seriesCover,
        profilePhoto,
        showSeries,
        picked: { portrait: settings?.developPortraitIds, life: settings?.developLifeIds },
      }),
    [photos, seriesCover, profilePhoto, showSeries, settings?.developPortraitIds, settings?.developLifeIds],
  );
  return (
    <div className="dv-home site-page">
      {/* 下の余白は置かない（フッターの上の余白の設定に任せる）。見出し（h1）は、上の表紙の名前。 */}
      <Doors doors={doors} />
      {showGallery && (
        <p className="dv-archive">
          <Link to="/gallery" className="dv-archive__link">
            <span className="font-en">{settings?.navLabelGallery || "Gallery"}</span>
            <span className="dv-archive__note">すべての写真</span>
            <span className="dv-archive__arrow font-en" aria-hidden="true">
              →
            </span>
          </Link>
        </p>
      )}
      {after}
    </div>
  );
}
