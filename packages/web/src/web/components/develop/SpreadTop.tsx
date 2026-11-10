import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { sortPhotosBySetting } from "../../lib/photo-sort";
import { galleryExcludesSeries } from "../../lib/book";
import { galleryHasPhotos } from "../../lib/work-entries";
import { useScrollFadeIn } from "../../hooks/useScrollFadeIn";
import { Picture } from "../Picture";
import { JaPhrases } from "../JaPhrases";
import {
  DEVELOP_INQUIRY_HREF,
  developDoorCopy,
  developListPhotos,
  spreadOtherText,
  SPREAD_WORKS_LABEL,
} from "../../../shared/develop-structure";
import { EXHIBITION_LIST_PATH, EXHIBITION_NAV_LABEL, publicExhibitions } from "../../../shared/exhibitions";
import type { DevelopPhoto } from "./DevelopHome";
import "./spread.css";

type Settings = Record<string, string | null | undefined> | undefined;

function position(photo: DevelopPhoto): string | undefined {
  if (photo.focalX == null && photo.focalY == null) return undefined;
  return `${photo.focalX ?? 50}% ${photo.focalY ?? 50}%`;
}

function ratio(photo: DevelopPhoto): string | undefined {
  if (!photo.width || !photo.height) return undefined;
  const turned = Math.abs(photo.rotationDeg ?? 0) % 180 === 90;
  return turned ? `${photo.height} / ${photo.width}` : `${photo.width} / ${photo.height}`;
}

/** 続きの見開きで、1枚ずつの幅（頁の幅に対する割合）。縦の写真は細く、横の写真は広く。段ごとに変える。 */
function leafWidth(photo: DevelopPhoto, index: number): string {
  const tall = (photo.height ?? 0) > (photo.width ?? 0);
  const steps = tall ? [66, 72, 60, 70] : [100, 88, 94, 84];
  return `${steps[index % steps.length]}%`;
}

type Leaf = { photo: DevelopPhoto; href: string; label: string };

/**
 * 新しい構成のトップ「見開き」（2026-11-10、オーナーが見本 A 案を選んだ）。
 *
 * 1冊の本を開いた形：左の頁は頼まれて撮る写真（Portrait、依頼の入口）、右の頁は自分で撮る写真
 * （Works：シリーズ・日常・展示）、真ん中は背（名前）。背の線はページの終わりまで通り、左右に
 * 1枚ずつ写真が続き、最後に 左＝依頼、右＝作品の目次。
 *
 * - 入口の2枚は、管理画面「ページの写真」→「表紙」で選んだ1枚目（左）と2枚目（右）。
 *   2枚選んでいなければ、左は Portrait の最初の写真、右は表紙の1枚か最初のシリーズの表紙。
 * - 動きは、写真が届いてから濃くなることと、触れた言葉の下線だけ（写真は動かさない）。
 * - Life には依頼を出さない。Works の側は「人のほかの撮影」の相談（設定 homeCtaOtherText）。
 */
export function SpreadTop({ settings, covers }: { settings: Settings; covers: DevelopPhoto[] }) {
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const { data: photoCounts } = useQuery({
    queryKey: ["photo-availability"],
    queryFn: async (): Promise<{ total: number; standalone: number }> =>
      jsonOrThrow(await api.photos.availability.$get()),
    staleTime: 60_000,
  });
  const photos = useMemo(
    () => sortPhotosBySetting(photosQ.data?.photos ?? [], "manual") as DevelopPhoto[],
    [photosQ.data],
  );
  const copy = developDoorCopy(settings?.developDoors);
  const portraits = useMemo(
    () => developListPhotos("portrait", photos, settings?.developPortraitIds),
    [photos, settings?.developPortraitIds],
  );
  const life = useMemo(() => developListPhotos("life", photos, settings?.developLifeIds), [photos, settings?.developLifeIds]);
  const series = useMemo(() => seriesQ.data?.series ?? [], [seriesQ.data]);
  const works = useMemo(() => worksQ.data?.series ?? [], [worksQ.data]);
  const shelves = useMemo(
    () => [
      ...series.map((s) => ({ ...s, href: `/series/${s.slug}` })),
      ...works.map((s) => ({ ...s, href: `/work/${s.slug}` })),
    ],
    [series, works],
  );
  const shelfCovers = useMemo<Leaf[]>(
    () =>
      shelves
        .filter((s) => s.coverUrl)
        .map((s) => ({
          photo: {
            url: s.coverUrl!,
            width: s.coverWidth,
            height: s.coverHeight,
            rotationDeg: s.coverRotationDeg,
            focalX: s.coverFocalX,
            focalY: s.coverFocalY,
          },
          href: s.href,
          label: s.title,
        })),
    [shelves],
  );

  const left = covers.length >= 2 ? covers[0]! : (portraits[0] ?? covers[0] ?? null);
  const right = covers.length >= 2 ? covers[1]! : (covers[0] && portraits[0] ? covers[0] : (shelfCovers[0]?.photo ?? life[0] ?? null));
  const worksHref = shelves.length > 0 ? "/series" : "/life";

  // 続きの見開き：左は Portrait の写真、右はシリーズの表紙と日常の写真を交互に。入口と同じ写真は出さない。
  const pairs = useMemo(() => {
    const used = new Set([left?.url, right?.url]);
    const l: Leaf[] = portraits
      .filter((p) => !used.has(p.url))
      .map((photo) => ({ photo, href: "/portrait", label: copy.portrait.label }));
    const lifeLeaves: Leaf[] = life.map((photo) => ({ photo, href: "/life", label: copy.life.label }));
    const r: Leaf[] = [];
    for (let i = 0; i < Math.max(shelfCovers.length, lifeLeaves.length); i++) {
      if (shelfCovers[i]) r.push(shelfCovers[i]!);
      if (lifeLeaves[i]) r.push(lifeLeaves[i]!);
    }
    const rr = r.filter((leaf) => !used.has(leaf.photo.url));
    const count = Math.min(4, l.length, rr.length);
    return Array.from({ length: count }, (_, i) => [l[i]!, rr[i]!] as const);
  }, [portraits, life, shelfCovers, left?.url, right?.url, copy.portrait.label, copy.life.label]);

  const site = typeof window !== "undefined" ? window.location.hostname : undefined;
  const hasExhibition = publicExhibitions(settings, site).length > 0;
  const showGallery = galleryHasPhotos(photoCounts, galleryExcludesSeries(settings));
  const ctaOn = settings?.homeCtaEnabled === "on";
  const ctaText = (settings?.homeCtaText || "").trim();
  const ctaLabel = settings?.homeCtaTitle || "撮影のご依頼";
  const other = ctaOn ? spreadOtherText(settings?.homeCtaOtherText) : "";
  const name = settings?.siteName ?? "";
  const vertical = /^[぀-ヿ㐀-鿿\s]{1,8}$/.test(name);
  const [shown, setShown] = useState({ left: false, right: false });
  const fadeRef = useScrollFadeIn([pairs.length, shelves.length]);

  const page = (side: "left" | "right", photo: DevelopPhoto | null, href: string, word: string, note: string, meta: string) => (
    <Link to={href} className={`sp-page sp-page--${side}`}>
      {photo && (
        <Picture
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          mediumUrl={photo.mediumUrl}
          width={photo.width}
          height={photo.height}
          rotationDeg={photo.rotationDeg}
          alt=""
          preset="hero"
          sizes="(min-width: 768px) 50vw, 100vw"
          fallbackW={1600}
          fallbackQ={82}
          className={`sp-page__img${shown[side] ? " is-on" : ""}`}
          style={{ objectPosition: position(photo) }}
          loading="eager"
          fetchPriority={side === "left" ? "high" : "auto"}
          draggable={false}
          onLoad={() => setShown((v) => ({ ...v, [side]: true }))}
        />
      )}
      <span className="sp-page__shade" />
      <span className="sp-page__text">
        {note && <span className="sp-page__note">{note}</span>}
        <span className="sp-page__word font-en">{word}</span>
        <span className="sp-page__meta">
          {meta && (
            <span className="sp-page__metatext">
              <JaPhrases>{meta}</JaPhrases>
            </span>
          )}
          <span className="sp-go">
            見る
            <span className="sp-go__arrow font-en" aria-hidden="true">
              →
            </span>
          </span>
        </span>
      </span>
    </Link>
  );

  const leaf = (item: Leaf, side: "l" | "r", index: number) => (
    <Link to={item.href} className={`sp-leaf sp-leaf--${side} fade-in-item`} style={{ width: leafWidth(item.photo, index + (side === "r" ? 1 : 0)) }}>
      <span className="sp-leaf__frame" style={{ aspectRatio: ratio(item.photo) }}>
        <Picture
          url={item.photo.url}
          thumbUrl={item.photo.thumbUrl}
          mediumUrl={item.photo.mediumUrl}
          width={item.photo.width}
          height={item.photo.height}
          rotationDeg={item.photo.rotationDeg}
          alt={item.photo.title || ""}
          preset="grid"
          sizes="(min-width: 768px) 46vw, 82vw"
          fallbackW={1200}
          fallbackQ={80}
          className="sp-leaf__img"
          loading="lazy"
          draggable={false}
        />
      </span>
      <span className="sp-leaf__label font-en">{item.label}</span>
    </Link>
  );

  return (
    <div className="sp" ref={fadeRef}>
      <section className="sp-spread" aria-label="入口">
        {page("left", left, "/portrait", copy.portrait.label, copy.portrait.note, ctaOn ? ctaText : "")}
        <div className="sp-spine">
          <h1 className="sp-spine__name" data-vertical={vertical ? "" : undefined}>
            {name}
          </h1>
        </div>
        {page("right", right, worksHref, SPREAD_WORKS_LABEL, copy.series.note, "")}
      </section>

      {pairs.length > 0 && (
        <section className="sp-gutter" aria-label="写真">
          {pairs.map(([l, r], i) => (
            <div className="sp-pair" key={`${l.photo.url}-${r.photo.url}`}>
              {leaf(l, "l", i)}
              {leaf(r, "r", i)}
            </div>
          ))}
        </section>
      )}

      <section className="sp-colophon">
        {ctaOn && (
          <div className="sp-colophon__l">
            <p className="sp-label font-en">{copy.portrait.label}</p>
            {ctaText && (
              <p className="sp-colophon__text">
                <JaPhrases>{ctaText}</JaPhrases>
              </p>
            )}
            <p className="sp-ask">
              <Link to={DEVELOP_INQUIRY_HREF} className="sp-go">
                {ctaLabel}
                <span className="sp-go__arrow font-en" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          </div>
        )}
        <div className="sp-colophon__r">
          <p className="sp-label font-en">{SPREAD_WORKS_LABEL}</p>
          <ul className="sp-index">
            {shelves.map((s) => (
              <li key={s.href}>
                <Link to={s.href}>
                  <b className="font-en">{s.title}</b>
                  {s.photoCount > 0 && <span>{s.photoCount}</span>}
                </Link>
              </li>
            ))}
            {life.length > 0 && (
              <li>
                <Link to="/life">
                  <b className="font-en">{copy.life.label}</b>
                </Link>
              </li>
            )}
            {hasExhibition && (
              <li>
                <Link to={EXHIBITION_LIST_PATH}>
                  <b className="font-en">{EXHIBITION_NAV_LABEL}</b>
                </Link>
              </li>
            )}
            {showGallery && (
              <li>
                <Link to="/gallery">
                  <b className="font-en">{settings?.navLabelGallery || "Gallery"}</b>
                </Link>
              </li>
            )}
          </ul>
          {other && (
            <p className="sp-other">
              <JaPhrases>{other}</JaPhrases>
              <Link to={DEVELOP_INQUIRY_HREF} className="sp-go">
                ご相談
                <span className="sp-go__arrow font-en" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
