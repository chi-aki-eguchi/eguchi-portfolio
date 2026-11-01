import { useEffect, useRef, useState } from "react";
import { Picture } from "../Picture";
import { JaPhrases } from "../JaPhrases";
import type { GalleryPhoto } from "../PhotoGallery";
import { useScrollFadeIn } from "../../hooks/useScrollFadeIn";
import { orientedDimensions } from "../../../shared/image-url";
import { safeHref } from "../../lib/utils";
import { sendAnalyticsEvent } from "../../lib/analytics";
import { assertOk } from "../../lib/api";
import {
  EXHIBITION_CARD_COOKIE,
  EXHIBITION_CARD_PLACES,
  EXHIBITION_POEM_FONT,
  EXHIBITION_REPLY_MAX,
  EXHIBITION_THANKS_PHOTO,
  EXHIBITION_WALL,
  exhibitionCardVisitor,
  exhibitionShape,
  exhibitionTextFitsSheet,
  type ExhibitionPhoto,
  type WallBox,
} from "../../../shared/exhibition";
import { photoAltText } from "../../../shared/photo-alt";
import type { PhotoViewerState } from "../photo-site/viewer";
import "./exhibition.css";

export type ExhibitionItem = GalleryPhoto | ExhibitionPhoto;

/**
 * 名刺の QR から来た人か。実際に名刺から来たときだけ、1つのタブで1回数える（名前も端末も送らない。
 * 確かめるための `?card` では数えない）。
 */
export function useExhibitionCardVisitor(): boolean {
  const [visitor] = useState(
    () => typeof document !== "undefined" && exhibitionCardVisitor(document.cookie, window.location.search),
  );
  useEffect(() => {
    if (!visitor || !exhibitionCardVisitor(document.cookie, "")) return;
    try {
      if (sessionStorage.getItem(EXHIBITION_CARD_COOKIE)) return;
      sessionStorage.setItem(EXHIBITION_CARD_COOKIE, "1");
    } catch {
      // 覚えておけない環境では、開くたびに数える。
    }
    sendAnalyticsEvent("exhibition_card_visit");
  }, [visitor]);
  return visitor;
}

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

/** 壁の中の置き場所。PC は会場の位置、スマホは掛け直した位置（どちらを使うかは exhibition.css）。 */
function wallPlace(wall: WallBox, phone: WallBox) {
  return {
    "--ex-x": `${wall.x}%`,
    "--ex-y": `${wall.y}%`,
    "--ex-w": `${wall.w}%`,
    "--ex-h": `${wall.h}%`,
    "--ex-sx": `${phone.x}%`,
    "--ex-sy": `${phone.y}%`,
    "--ex-sw": `${phone.w}%`,
    "--ex-sh": `${phone.h}%`,
  } as React.CSSProperties;
}

/**
 * 壁の1枚。画像が届いてから現像を始める（届く前に動きが終わると、あとで急に写真が出る。会場の回線は
 * 混むことがある）。届くまでは写真の場所に薄い面を置いて、壁の形だけ先に見せる。
 */
function WallPrint({ photo }: { photo: ExhibitionItem }) {
  const [ready, setReady] = useState(false);
  return (
    <span className="ex-wall__print" data-ready={ready ? "" : undefined}>
      <Picture
        url={photo.url}
        width={photo.width}
        height={photo.height}
        alt=""
        preset="grid"
        sizes="(min-width: 768px) 24vw, 52vw"
        fallbackW={800}
        fallbackQ={84}
        className="ex-wall__img"
        loading="eager"
        fetchPriority="high"
        draggable={false}
        onLoad={() => setReady(true)}
        imgRef={(img) => {
          if (img?.complete && img.naturalWidth > 0) setReady(true);
        }}
      />
    </span>
  );
}

/**
 * 会場の壁の配置。展示を見てきた人が、開いてすぐ「さっきの壁だ」と分かるように、5枚と詩の紙・名刺を
 * 会場と同じ順に置く。PC は額と写真の大きさの比まで会場どおり、スマホは写真が大きく見えるように掛け直す。
 * 写真は左上から順に現像される（`.ex-cover[data-on]` になってから。開いた瞬間の見せ場の裏で終わらないように）。
 */
export function ExhibitionWall({
  photos,
  viewer,
  text,
  name,
  photographerName,
}: {
  photos: ExhibitionItem[];
  viewer: PhotoViewerState;
  text: string;
  /** 名刺の表の名前。 */
  name?: string;
  photographerName?: string;
}) {
  const fits = text && exhibitionTextFitsSheet(text);
  return (
    <div className="ex-wall" style={{ "--ex-phone-ar": EXHIBITION_WALL.phone.ratio } as React.CSSProperties}>
      {EXHIBITION_WALL.works.map(({ id, frame, print, phone }, order) => {
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
                ...wallPlace(frame, phone),
                "--ex-px": `${print.x}%`,
                "--ex-py": `${print.y}%`,
                "--ex-pw": `${print.w}%`,
                "--ex-ph": `${print.h}%`,
                "--ex-order": order,
              } as React.CSSProperties
            }
          >
            <WallPrint photo={photo} />
          </button>
        );
      })}
      {fits && (
        <a
          className="ex-wall__sheet"
          href="#ex-sheet"
          aria-label="詩へ"
          style={wallPlace(EXHIBITION_WALL.sheet, EXHIBITION_WALL.phone.sheet)}
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
          style={wallPlace(card, EXHIBITION_WALL.phone.cards[i]!)}
        >
          {i === 0 && name && <span aria-hidden="true">{name}</span>}
        </a>
      ))}
    </div>
  );
}

/**
 * 表紙の下の札。展示の壁で作品の横に添える札と同じで、誰の・どの展示の写真かだけを置く。
 * 壁のトップでは、名前も題と同じ小さな字で（name）。1枚の表紙のときは表紙の名前の部品を受け取る。
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
 * 本人へ届く、ひとことの欄。名前も連絡先も聞かない（在廊できない展示の、感想ノートの代わり）。
 * サイトに保存し（管理画面で読む）、お問い合わせと同じ送り先へメールでも知らせる。どちらかが通れば届いている。
 */
function ExhibitionReply({ endpoint, name }: { endpoint: string; name: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  if (status === "sent") {
    return (
      <output className="ex-reply__sent">届きました。ありがとう。</output>
    );
  }
  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    // 人には見えない欄。埋まっていたら機械の送信なので、送ったふりだけする。
    if (String(body.get("_gotcha") ?? "").trim()) return setStatus("sent");
    const message = String(body.get("message") ?? "").trim();
    if (!message) return;
    setStatus("sending");
    const post = async (url: string, init: RequestInit) => assertOk(await fetch(url, { method: "POST", ...init }));
    const results = await Promise.allSettled([
      post("/api/exhibition/notes", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
      ...(endpoint ? [post(endpoint, { headers: { Accept: "application/json" }, body })] : []),
    ]);
    if (results.some((result) => result.status === "fulfilled")) {
      setStatus("sent");
      sendAnalyticsEvent("exhibition_reply_sent");
    } else {
      setStatus("failed");
    }
  };
  return (
    <form className="ex-reply" onSubmit={(event) => void send(event)}>
      <input type="hidden" name="_subject" value="展示のQRから、ひとこと" />
      <input className="ex-reply__trap" type="text" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <textarea
        name="message"
        rows={2}
        required
        maxLength={EXHIBITION_REPLY_MAX}
        aria-label={`${name}へひとこと`}
        placeholder="この写真好きです！も、お待ちしております"
      />
      <div className="ex-reply__foot">
        {status === "failed" && <p role="alert">送れませんでした。少しあとで、もう一度お願いします。</p>}
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "送っています" : "送る"}
        </button>
      </div>
    </form>
  );
}

/**
 * 名刺の QR から来た人にだけ出す、最後のやりとり（2026-11-01）。在廊できないので、本人の代わりにここで迎える。
 * 壁に掛けなかった1枚を、紙に焼いた1枚のように渡し、ひとことと、本人へ返せる欄を添える。
 */
function ExhibitionThanks({
  text,
  replyEndpoint,
  name,
}: {
  text: string;
  replyEndpoint: string;
  name: string;
}) {
  const photo = EXHIBITION_THANKS_PHOTO;
  return (
    <section id="ex-thanks" className="ex-thanks" aria-label="名刺を読んでくれた人へ">
      <div className="ex-thanks__print fade-in-item">
        <Picture
          url={photo.url}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          preset="grid"
          sizes="(min-width: 768px) 22rem, 78vw"
          fallbackW={800}
          fallbackQ={84}
          className="ex-thanks__img"
          loading="lazy"
          draggable={false}
        />
      </div>
      <p className="ex-thanks__word">{text}</p>
      <ExhibitionReply endpoint={replyEndpoint} name={name} />
    </section>
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
  thanks,
  replyEndpoint,
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
  /** 名刺の QR から来た人へのひとこと。空なら、写真と欄ごと出さない。 */
  thanks: string;
  /** ひとことをメールでも知らせる送り先（お問い合わせと同じ）。無ければサイトへの保存だけ。 */
  replyEndpoint: string;
  photographerName?: string;
}) {
  const fadeRef = useScrollFadeIn([photos.length]);
  usePoemFont(text);
  const cardVisitor = useExhibitionCardVisitor();
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
      {cardVisitor && thanks.trim() && <ExhibitionThanks text={thanks} replyEndpoint={replyEndpoint} name={name} />}
      <ExhibitionCards name={name} nameEn={nameEn} links={links} />
    </section>
  );
}
