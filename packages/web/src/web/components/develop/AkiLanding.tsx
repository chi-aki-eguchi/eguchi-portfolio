import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { Picture } from "../Picture";
import { orientedDimensions } from "../../lib/picture";
import { photoAltText } from "../../../shared/photo-alt";
import type { DevelopPhoto } from "./DevelopHome";
import "./aki-landing.css";

/*
 * 江口秋のトップ（2026-11-19、作者が選んだ案を scratch/site-walk から移した）。
 *
 * ・最初の一作（いまは展示）だけ、1画面に一枚。紙の余白に、元の縦横比の一枚と、題を一度だけ。切り抜かない。角も丸めない。
 * ・続く作品は、歩きながら見る並び（2026-11-19）：小さめの表紙を左・右と交互に置く。縦でも横でも同じ面積。
 *   どれも同じ1画面だと、入口と続きが同じ強さに見え、開いても写真が大きくならなかった。
 * ・初めて来たときだけ、入る前の一拍：名前が一字ずつ現れて、消え、紙が引いて最初の写真が現れる（約2.4秒）。
 *   触れば 0.25 秒で引く。その一回のタップでは下の作品を開かない。
 * ・写真は、届いて画面に入ったときに一度だけ濃淡で現れる。作品から戻ってきたときは待たせない。
 * ・返事は言葉の側だけ（題の横の矢印が少し進む）。写真は動かさず、濃さも変えない。
 *
 * 上の帯（名前・目次）はここでは描かない。帯の高さは --header-h と --sai-top から引く。
 */

export type AkiLandingEntry = { href: string; title: string; photo: DevelopPhoto };

const SEEN_KEY = "aki-landing-seen";
/** 一拍の長さ。CSS（aki-landing.css の aki-veil）と同じ値にする。 */
const ENTRANCE_MS = 2400;
/** 途中で触ったときに引く長さ。CSS（.aki-entrance[data-phase="leaving"]）と同じ値にする。 */
const LEAVE_MS = 250;

type Phase = "none" | "play" | "leaving";

/** この画面を、ページを開いてから一度でも出したか。戻ってきたときは写真を待たせない。 */
let shownBefore = false;

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  // サイトの「現れ方なし」の設定（provider が body に書く）。
  return document.body.dataset.reveal !== "none";
}

function firstVisit(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    // 覚えておけない環境では、開くたびに一拍が流れる。
    return true;
  }
}

/** 写真の縦横比（横 ÷ 縦。回した写真は入れ替える）。寸法が無い写真は、届いた画像の比に任せる。 */
function ratioOf(photo: DevelopPhoto): number | undefined {
  const { width, height } = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  return width && height ? width / height : undefined;
}

function Arrow() {
  return (
    <svg className="aki-work__arrow-mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11.5M10.5 5l5 5-5 5" />
    </svg>
  );
}

function Work({
  entry,
  first,
  step,
  instant,
  photographerName,
}: {
  entry: AkiLandingEntry;
  first: boolean;
  /** 続く作品の並びの中で何番目か（1から）。最初の一作には渡さない。 */
  step?: number;
  /** 戻ってきたとき：届いている写真は、濃淡を掛けずにそのまま出す。 */
  instant: boolean;
  photographerName: string;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [plain, setPlain] = useState(false);

  // この履歴で選んだ表紙が DOM に戻った時、同じ高さから次を読めるようにする。
  useLayoutEffect(() => {
    const link = linkRef.current;
    const state = window.history.state;
    const spot = state?.akiCover;
    if (!link || spot?.href !== entry.href || !Number.isFinite(spot.topRatio)) return;
    const offset = link.getBoundingClientRect().top - spot.topRatio * window.innerHeight;
    window.scrollBy({ top: offset, behavior: "instant" });
    if (spot.keyboard) link.focus({ preventScroll: true });
    const remaining = { ...state };
    delete remaining.akiCover;
    window.history.replaceState(remaining, "");
  }, [entry.href]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      if (instant) setPlain(true);
    }
  }, [instant]);

  useEffect(() => {
    const el = linkRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { photo } = entry;
  const ratio = ratioOf(photo);
  const shown = inView && loaded;
  // 続く作品：幅に √比 を掛けると、縦でも横でも同じ面積になる（aki-landing.css の .aki-walk）。
  const linkStyle = ratio ? ({ "--ar": ratio, "--k": Math.sqrt(ratio).toFixed(4) } as CSSProperties) : undefined;

  return (
    <article className="aki-work" style={step ? ({ "--i": step } as CSSProperties) : undefined}>
      <Link
        ref={linkRef}
        href={entry.href}
        onClick={(event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const topRatio = event.currentTarget.getBoundingClientRect().top / window.innerHeight;
          window.history.replaceState({
            ...window.history.state, akiCover: { href: entry.href, topRatio, keyboard: event.detail === 0 },
          }, "");
        }}
        aria-label={entry.href.startsWith("/exhibition/") ? entry.title + " 展示を見る" : undefined}
        className="aki-work__link"
        data-shown={shown ? "" : undefined}
        data-plain={plain ? "" : undefined}
        data-free={ratio ? undefined : ""}
        style={linkStyle}
      >
        <span className="aki-work__plate">
          <Picture
            url={photo.url}
            thumbUrl={photo.thumbUrl}
            mediumUrl={photo.mediumUrl}
            width={photo.width}
            height={photo.height}
            rotationDeg={photo.rotationDeg}
            alt={photoAltText(photo, { photographerName, seriesName: entry.title })}
            preset="hero"
            sizes={first ? "(min-width: 900px) min(66rem, 80vw), calc(100vw - 40px)" : "(min-width: 900px) 36vw, 75vw"}
            fallbackW={1600}
            fallbackQ={84}
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : undefined}
            imgRef={imgRef}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            draggable={false}
          />
        </span>
        <h2 className="aki-work__title">
          <span>{entry.title}</span>
          <span className="aki-work__arrow">
            <Arrow />
          </span>
        </h2>
      </Link>
    </article>
  );
}

export function AkiLanding({
  entries,
  name = "江口秋",
}: {
  entries: AkiLandingEntry[];
  /** 入る前の一拍に出す名前。渡さなければ「江口秋」。 */
  name?: string;
}) {
  const [phase, setPhase] = useState<Phase>(() => (firstVisit() && motionAllowed() ? "play" : "none"));
  const [instant] = useState(() => shownBefore);
  const veilRef = useRef<HTMLDivElement>(null);
  const [lead, ...rest] = entries;

  useEffect(() => {
    shownBefore = true;
  }, []);

  // 一拍：流れきったら外す。途中で触られたら、いまの濃さから引く。
  useEffect(() => {
    if (phase !== "play") return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 覚えておけなくても、そのまま流す。
    }
    const done = window.setTimeout(() => setPhase("none"), ENTRANCE_MS);
    const skip = () => {
      const veil = veilRef.current;
      if (veil) veil.style.opacity = getComputedStyle(veil).opacity;
      setPhase("leaving");
    };
    const inputs = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
    for (const type of inputs) window.addEventListener(type, skip, { passive: true, capture: true, once: true });
    return () => {
      window.clearTimeout(done);
      for (const type of inputs) window.removeEventListener(type, skip, { capture: true });
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const frame = requestAnimationFrame(() => {
      if (veilRef.current) veilRef.current.style.opacity = "0";
    });
    const done = window.setTimeout(() => setPhase("none"), LEAVE_MS + 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [phase]);

  const letters = Array.from(name);
  // 字が増えても、名前が出そろう時刻（0.75秒＋現れる長さ）は変えない。
  const step = letters.length > 1 ? Math.min(0.3, 0.6 / (letters.length - 1)) : 0;

  return (
    <section className="aki-landing" data-entrance={phase === "none" ? undefined : phase} aria-label="作品">
      {phase !== "none" && (
        <div className="aki-entrance" ref={veilRef} data-phase={phase} aria-hidden="true">
          <p>
            {letters.map((letter, i) => (
              <span key={i} style={{ "--d": `${(0.15 + i * step).toFixed(2)}s` } as CSSProperties}>
                {letter}
              </span>
            ))}
          </p>
        </div>
      )}
      <h1 className="aki-landing__heading">{name}の作品</h1>
      {lead && <Work key={lead.href} entry={lead} first instant={instant} photographerName={name} />}
      {rest.length > 0 && (
        <div className="aki-walk">
          {rest.map((entry, i) => (
            <Work
              key={entry.href}
              entry={entry}
              first={false}
              step={i + 1}
              instant={instant}
              photographerName={name}
            />
          ))}
        </div>
      )}
    </section>
  );
}
