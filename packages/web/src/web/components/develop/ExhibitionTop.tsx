import { useEffect, useRef, useState } from "react";
import { Picture } from "../Picture";
import { JaPhrases } from "../JaPhrases";
import type { GalleryPhoto } from "../PhotoGallery";
import { useScrollFadeIn } from "../../hooks/useScrollFadeIn";
import { orientedDimensions } from "../../../shared/image-url";
import { safeHref } from "../../lib/utils";
import {
  EXHIBITION_CARD_PLACES,
  EXHIBITION_POEM_FONT,
  EXHIBITION_WALL,
  exhibitionShape,
  exhibitionTextFitsSheet,
  type ExhibitionPhoto,
} from "../../../shared/exhibition";
import { photoAltText } from "../../../shared/photo-alt";
import type { PhotoViewerState } from "../photo-site/viewer";
import "./exhibition.css";

export type ExhibitionItem = GalleryPhoto | ExhibitionPhoto;

/** 詩の書体を、使う字だけ読み込む（原稿と同じ書体。全部読むと数MBになる）。 */
function usePoemFont(text: string) {
  useEffect(() => {
    if (!text) return;
    const glyphs = encodeURIComponent([...new Set(Array.from(text.replace(/\s/g, "")))].join(""));
    const href = `https://fonts.googleapis.com/css2?family=${EXHIBITION_POEM_FONT.replace(/ /g, "+")}&display=swap&text=${glyphs}`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => link.remove();
  }, [text]);
}

/** 紙の上の詩。組みは原稿の比のまま（行の頭をそろえ、折り返さない）。 */
function Poem({ text, live }: { text: string; live?: boolean }) {
  const lines = text.trim().split("\n");
  return (
    <p className="ex-poem" lang="ja">
      {lines.map((line, i) => (
        // 行の並びは変わらない（詩の行を順に置くだけ）。
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} style={live ? ({ "--ex-i": i } as React.CSSProperties) : undefined}>
          {line.trim()}
        </span>
      ))}
    </p>
  );
}

/**
 * 会場の壁の配置。展示を見てきた人が、開いてすぐ「さっきの壁だ」と分かるように、5枚と詩の紙・札を
 * 会場と同じ位置に置く。PC は額と写真の大きさの比まで会場どおり、スマホは写真が見えるように額いっぱいに。
 * 写真が左上から順に現像される（on になってから。開いた瞬間の見せ場の裏で終わってしまわないように）。
 */
export function ExhibitionWall({
  photos,
  viewer,
  text,
  on,
  name,
  photographerName,
}: {
  photos: ExhibitionItem[];
  viewer: PhotoViewerState;
  text: string;
  on: boolean;
  /** 札に小さく置く名前。 */
  name?: string;
  photographerName?: string;
}) {
  const fits = text && exhibitionTextFitsSheet(text);
  return (
    <div className="ex-wall" data-on={on ? "" : undefined}>
      {EXHIBITION_WALL.works.map(({ id, frame, print }, order) => {
        const index = photos.findIndex((photo) => photo.id === id);
        const photo = photos[index];
        if (!photo) return null;
        return (
          <button
            key={id}
            type="button"
            className="ex-wall__frame"
            data-photo-tile={id}
            aria-label={`${photoAltText(photo, { photographerName })}を大きく見る`}
            onClick={() => viewer.open(index)}
            style={
              {
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.w}%`,
                height: `${frame.h}%`,
                "--ex-px": `${print.x}%`,
                "--ex-py": `${print.y}%`,
                "--ex-pw": `${print.w}%`,
                "--ex-ph": `${print.h}%`,
                "--ex-order": order,
              } as React.CSSProperties
            }
          >
            <span className="ex-wall__print">
              <Picture
                url={photo.url}
                width={photo.width}
                height={photo.height}
                alt=""
                preset="grid"
                sizes="(min-width: 768px) 24vw, 34vw"
                fallbackW={800}
                fallbackQ={84}
                className="ex-wall__img"
                loading="eager"
                fetchPriority="high"
                draggable={false}
              />
            </span>
          </button>
        );
      })}
      {fits && (
        <a
          className="ex-wall__sheet"
          href="#ex-sheet"
          aria-label="詩へ"
          style={{
            left: `${EXHIBITION_WALL.sheet.x}%`,
            top: `${EXHIBITION_WALL.sheet.y}%`,
            width: `${EXHIBITION_WALL.sheet.w}%`,
            height: `${EXHIBITION_WALL.sheet.h}%`,
          }}
        >
          <span aria-hidden="true">
            <Poem text={text} />
          </span>
        </a>
      )}
      {EXHIBITION_WALL.cards.map((card, i) => (
        <a
          // 札は2枚の決まった並び。
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="ex-wall__card"
          href="#ex-cards"
          aria-label="名刺へ"
          style={{ left: `${card.x}%`, top: `${card.y}%`, width: `${card.w}%`, height: `${card.h}%` }}
        >
          {i === 0 && name && <span aria-hidden="true">{name}</span>}
        </a>
      ))}
    </div>
  );
}

/**
 * 表紙の下の札。展示の壁で作品の横に添える札と同じで、誰の・どの展示の写真かだけを置く。
 * 名前は表紙の部品と同じ物（pages/top.tsx の ClassicHeroNameBlock）を受け取る。
 */
export function ExhibitionLabel({
  name,
  title,
  dates,
}: {
  name: React.ReactNode;
  title: string;
  dates: string;
}) {
  return (
    <div className="ex-label">
      <div className="ex-label__name">{name}</div>
      {(title || dates) && (
        <div className="ex-label__show">
          {title && <h2 className="hero-text-reveal hero-text-reveal-2">{title}</h2>}
          {dates && <p className="hero-text-reveal hero-text-reveal-3">{dates}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * 会場の詩の紙。A4 の比の紙の、上寄りの右に置き、下を空けたままにする（原稿の組み）。下の余白も詩の一部。
 * 紙が画面に入ったら、右の行から順に現れる。
 */
function ExhibitionSheet({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} id="ex-sheet" className="ex-sheet" data-on={on ? "" : undefined}>
      <Poem text={text} live />
    </div>
  );
}

/**
 * 名刺の表と裏。会場の壁と同じく、詩の紙の下に2枚並べる。表は名刺の組みのまま縦書きの名前。
 * 裏は名刺と同じ並びで、QR の場所を押せる言葉にする（スマホの中の QR は読めない）。
 * 電話番号とメールは載せない（連絡は Info のフォーム）。
 */
function ExhibitionCards({
  name,
  nameEn,
  links,
}: {
  name: string;
  nameEn: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div id="ex-cards" className="ex-cards">
      <div className="ex-card">
        <p className="ex-card__name" lang="ja">
          {name}
        </p>
      </div>
      <div className="ex-card ex-card--back" lang="en">
        <p className="ex-card__en">{nameEn}</p>
        {links.length > 0 && (
          <div className="ex-card__links">
            {links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        )}
        <p className="ex-card__where">{EXHIBITION_CARD_PLACES}</p>
      </div>
    </div>
  );
}

/**
 * 写真の続き。1枚ずつ、切り抜かず、地の紙の上に置く。写真の上には何も重ねない。
 * 枚数が増えても同じ規則で並ぶ（置き方は写真の形と順番から決まる。exhibition.css）。
 * 押すといつものビューアが開く。最後に詩の紙と名刺（会場の壁の右下と同じ並び）。
 */
export function ExhibitionWorks({
  photos,
  from,
  viewer,
  label,
  text,
  name,
  nameEn,
  instagram,
  x,
  photographerName,
}: {
  /** 名刺の名前。 */
  name: string;
  nameEn: string;
  /** 名刺の裏のリンク（設定の住所。無い物は出さない）。 */
  instagram?: { label: string; href?: string | null };
  x?: { label: string; href?: string | null };
  /** 表紙も含めた全部の写真。 */
  photos: ExhibitionItem[];
  /** ここに並べる最初の写真（表紙に1枚使っていれば 1）。 */
  from: number;
  viewer: PhotoViewerState;
  /** 読み上げ用の一覧の名前。 */
  label: string;
  /** 詩・添える文。空なら出さない。 */
  text: string;
  photographerName?: string;
}) {
  const fadeRef = useScrollFadeIn([photos.length]);
  usePoemFont(text);
  const links = [instagram, x].flatMap((link) => {
    const href = link?.href ? safeHref(link.href) : "";
    return link && href ? [{ label: link.label, href }] : [];
  });
  return (
    <section className="ex-works" aria-label={label} ref={fadeRef}>
      <ol className="ex-works__list">
        {photos.slice(from).map((photo, i) => {
          const size = orientedDimensions(photo.width, photo.height, (photo as GalleryPhoto).rotationDeg);
          return (
            <li
              key={photo.id}
              className="ex-work"
              data-shape={exhibitionShape(size.width, size.height)}
              data-side={i % 2 === 0 ? "right" : "left"}
            >
              <button
                type="button"
                className="ex-work__open fade-in-item"
                data-photo-tile={photo.id}
                onClick={() => viewer.open(i + from)}
                style={
                  size.width && size.height
                    ? ({ "--ex-ar": String(size.width / size.height) } as React.CSSProperties)
                    : undefined
                }
              >
                <Picture
                  url={photo.url}
                  thumbUrl={(photo as GalleryPhoto).thumbUrl}
                  mediumUrl={(photo as GalleryPhoto).mediumUrl}
                  width={photo.width}
                  height={photo.height}
                  rotationDeg={(photo as GalleryPhoto).rotationDeg}
                  alt={photoAltText(photo, { photographerName })}
                  preset="grid"
                  sizes="(min-width: 768px) 60vw, 100vw"
                  fallbackW={1200}
                  fallbackQ={84}
                  className="ex-work__img"
                  loading="lazy"
                  draggable={false}
                />
              </button>
              {photo.title && <p className="ex-work__title">{photo.title}</p>}
            </li>
          );
        })}
      </ol>
      {text &&
        (exhibitionTextFitsSheet(text) ? (
          <ExhibitionSheet text={text} />
        ) : (
          <p className="ex-works__text">
            <JaPhrases>{text}</JaPhrases>
          </p>
        ))}
      <ExhibitionCards name={name} nameEn={nameEn} links={links} />
    </section>
  );
}
