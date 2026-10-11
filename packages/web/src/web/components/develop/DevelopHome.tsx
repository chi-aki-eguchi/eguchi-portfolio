import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Picture } from "../Picture";
import { developListPhotos } from "../../../shared/develop-structure";
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

/** 表紙の写真が替わる間隔。 */
export const COVER_INTERVAL_MS = 6400;

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
    { key: "portrait" as const, href: "/portrait", title: "Portrait", note: "人を撮る", photo: portrait[0] ?? null },
    { key: "life" as const, href: "/life", title: "Life", note: "日常の写真", photo: life[0] ?? null },
    ...(showSeries
      ? [{ key: "series" as const, href: "/series", title: "Series", note: "まとまった作品", photo: seriesCover }]
      : []),
    { key: "info" as const, href: "/info", title: "Info", note: "料金と依頼", photo: profilePhoto },
  ];
}

function position(photo: DevelopPhoto): string | undefined {
  if (photo.focalX == null && photo.focalY == null) return undefined;
  return `${photo.focalX ?? 50}% ${photo.focalY ?? 50}%`;
}

/**
 * 表紙。写真だけを枠いっぱいに出し、名前は重ねない（名前はメニューにある）。
 * 何枚か選んであれば、濃さだけで入れ替える。動きを減らす設定では入れ替えない。
 */
function Cover({ photos, name }: { photos: DevelopPhoto[]; name: string }) {
  const boxRef = useRef<HTMLElement>(null);
  const [top, setTop] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const count = photos.length;

  // 表紙の高さ = 画面の高さ − ここまでの高さ（上の帯など）− 下の1行。幅が変わったときだけ測り直す
  // （スマホは送るたびにアドレスバーで高さが変わるので、高さの変化では測り直さない）。
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let lastWidth = -1;
    const measure = () => {
      if (Math.abs(window.innerWidth - lastWidth) < 1) return;
      lastWidth = window.innerWidth;
      setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (count < 2) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setAt((i) => (i + 1) % count);
    }, COVER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  return (
    <section
      ref={boxRef}
      className="dv-cover"
      data-single={count < 2 ? "true" : undefined}
      aria-label="表紙"
      style={top === null ? undefined : ({ "--dv-cover-top": `${top}px` } as React.CSSProperties)}
    >
      <div className="dv-cover__frame">
        {photos.map((photo, i) => (
          <div key={photo.id ?? photo.url} className="dv-cover__photo" data-on={i === at ? "true" : undefined}>
            <Picture
              url={photo.url}
              thumbUrl={photo.thumbUrl}
              mediumUrl={photo.mediumUrl}
              width={photo.width}
              height={photo.height}
              rotationDeg={photo.rotationDeg}
              alt={i === 0 ? photo.title || `${name}の写真` : ""}
              preset="hero"
              sizes="(min-width: 768px) 80vw, 100vw"
              fallbackW={1920}
              fallbackQ={82}
              className="dv-cover__img"
              style={{ objectPosition: position(photo) }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              draggable={false}
            />
          </div>
        ))}
      </div>
      {count > 1 && (
        <p className="dv-cover__count font-en" aria-hidden="true">
          <span>{pad(at + 1)}</span>
          <span key={at} className="dv-cover__bar" />
          <span>{pad(count)}</span>
        </p>
      )}
    </section>
  );
}

/**
 * 扉の目次。大きな言葉が入口で、触れた（または選んだ）扉の写真が隣に出る。
 * スマホでは隣に置く幅が無いので、扉ごとに写真を上に添える。
 */
function Doors({ doors }: { doors: DevelopDoor[] }) {
  const [active, setActive] = useState(0);
  const staged = doors.filter((d) => d.photo);
  return (
    <section className="dv-doors" aria-label="目次">
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
                <span className="dv-door__photo">
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
  coverPhotos,
  photos,
  seriesCover,
  showSeries,
  showGallery,
  after,
}: {
  settings: Settings;
  coverPhotos: DevelopPhoto[];
  photos: DevelopPhoto[];
  seriesCover: DevelopPhoto | null;
  showSeries: boolean;
  showGallery: boolean;
  after?: React.ReactNode;
}) {
  const name = settings?.siteName || settings?.siteNameEn || settings?.profileName || "";
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
    <div className="dv-home site-page site-page-top">
      <h1 className="sr-only">{name || "Photographs"}</h1>
      <Cover photos={coverPhotos} name={name} />
      <Doors doors={doors} />
      {showGallery && (
        <p className="dv-archive">
          <Link to="/gallery" className="dv-archive__link">
            <span className="font-en">{settings?.navLabelGallery || "Gallery"}</span>
            <span className="dv-archive__note">すべての写真</span>
          </Link>
        </p>
      )}
      {after}
    </div>
  );
}
