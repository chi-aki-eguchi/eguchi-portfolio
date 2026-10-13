import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  INTRO_FONT_WAIT_MS,
  INTRO_GROW_AFTER_MS,
  INTRO_GROW_MS,
  INTRO_IMAGE_WAIT_MS,
  INTRO_OUT_MS,
  INTRO_PLATE_AFTER_MS,
  INTRO_SEEN_KEY,
  introLayout,
  isVerticalName,
  type IntroBox,
} from "../../lib/develop-intro";
import "./develop-intro.css";

/**
 * wait  紙だけ（書体を待つ）
 * on    名前がにじんで現れる
 * plate 図版が像で出て、現像される
 * grow  図版が表紙いっぱいに引き伸ばされる（名前は退く）
 * out   見せ場そのものが薄れて、下の表紙に替わる
 */
type Phase = "wait" | "on" | "plate" | "grow" | "out";
type Plate = { src: string; fit: string; position: string; ground: string };

/**
 * 開いた瞬間の見せ場：写真集の扉（新しい構成のトップ、2026-10-14）。
 *
 * 表紙（`pages/top.tsx` の heroSection）の上に重ねて流す。**表紙の部品には触らない**——
 * 写真は表紙に出ている画像をそのまま借り、像は表紙の下地の像（`.hero-latent` の絵）を写す。
 * 終わったら自分を片づけ、下にある表紙がそのまま見える（図版の最後の大きさ・切り抜きは、
 * 表紙の写真と同じ）。
 *
 * 動かすのは濃さと、図版の拡大（変形）と、名前のにじみ（小さい字のぼかし）だけ。
 * 流すかどうかは `lib/develop-intro.ts` の shouldPlayIntro が決める。
 */
export function DevelopIntro({
  name,
  caption,
  expectPhoto,
  onDone,
}: {
  name: string;
  /** 図版の下に小さく添える言葉（肩書きなど）。無ければ出さない。 */
  caption: string;
  /** 表紙に写真が出る見込みがあるか（読み込み中も true）。出ないと分かったら、待たずに終える。 */
  expectPhoto: boolean;
  onDone: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const latentRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("wait");
  const [boxes, setBoxes] = useState<{ stage: { w: number; h: number }; photo: IntroBox } | null>(null);
  const [plate, setPlate] = useState<Plate | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const expectRef = useRef(expectPhoto);
  expectRef.current = expectPhoto;
  const vertical = isVerticalName(name);
  const chars = Array.from(name.trim());

  // 置き場所は、表紙の写真の箱（写真が届く前から置いてある枠）から決める。
  // 写真が届いてから測ると、名前が現れている途中で位置が変わる。
  useLayoutEffect(() => {
    const root = rootRef.current;
    const host = root?.parentElement;
    if (!root || !host) return;
    const measure = () => {
      const stage = root.getBoundingClientRect();
      const frame = (host.querySelector(".hero-fx-layer") ?? root).getBoundingClientRect();
      setBoxes({
        stage: { w: stage.width, h: stage.height },
        photo: { x: frame.left - stage.left, y: frame.top - stage.top, w: frame.width, h: frame.height },
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const host = root?.parentElement;
    if (!root || !host) {
      doneRef.current();
      return;
    }
    let alive = true;
    let leaving = false;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const wait = (ms: number) => new Promise<void>((resolve) => later(resolve, ms));
    const leave = () => {
      if (!alive || leaving) return;
      leaving = true;
      setPhase("out");
      later(() => doneRef.current(), INTRO_OUT_MS + 40);
    };
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // 覚えておけない環境では、開くたびに流れる。
    }

    // 触られたら待たせない。すぐ表紙へ替わる。
    const onScroll = () => {
      if (window.scrollY > 4) leave();
    };
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of inputs) window.addEventListener(type, leave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    const heroImage = () =>
      host.querySelector<HTMLImageElement>(".hero-slide.active img, .hero-photo-reveal img");
    const drawable = (img: HTMLImageElement | null): img is HTMLImageElement =>
      !!img && img.complete && img.naturalWidth > 0;

    void (async () => {
      // 書体が替わる前に名前を出すと、にじんでいる途中で字の形が変わる。
      await Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(INTRO_FONT_WAIT_MS)]);
      if (!alive || leaving) return;
      setPhase("on");
      const started = performance.now();
      let img = heroImage();
      while (
        alive &&
        !leaving &&
        !drawable(img) &&
        expectRef.current &&
        performance.now() - started < INTRO_IMAGE_WAIT_MS
      ) {
        await wait(60);
        img = heroImage();
      }
      if (!alive || leaving) return;
      // 表紙の写真が無い・届かないなら、見せ場は名前だけで終える（名前が定まるまでは見せる）。
      if (!drawable(img)) {
        await wait(Math.max(0, 1500 - (performance.now() - started)));
        leave();
        return;
      }
      await img.decode?.().catch(() => {});
      // 表紙の下地の像（表紙が自分で描く小さな絵）が描けるのを、少しだけ待つ。
      const latentBy = performance.now() + 400;
      while (alive && !leaving && !host.querySelector(".hero-latent[data-ready]") && performance.now() < latentBy)
        await wait(50);
      if (!alive || leaving) return;
      const look = getComputedStyle(img);
      const ground = getComputedStyle(img.closest(".hero-single, .hero-carousel-contain") ?? root).backgroundColor;
      setPlate({
        src: img.currentSrc || img.src,
        fit: look.objectFit,
        position: look.objectPosition,
        ground,
      });
      await wait(Math.max(0, INTRO_PLATE_AFTER_MS - (performance.now() - started)));
      if (!alive || leaving) return;
      setPhase("plate");
      await wait(INTRO_GROW_AFTER_MS);
      if (!alive || leaving) return;
      setPhase("grow");
      await wait(INTRO_GROW_MS + 80);
      leave();
    })();

    return () => {
      alive = false;
      for (const id of timers) window.clearTimeout(id);
      for (const type of inputs) window.removeEventListener(type, leave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // 図版の像は、表紙の下地の像を写す（同じ写真の、もう描いてある絵）。まだ描けていなければ
  // 像なしで、色の付いた図版がそのまま出る。
  useLayoutEffect(() => {
    const canvas = latentRef.current;
    const host = rootRef.current?.parentElement;
    if (!plate || !canvas || !host) return;
    const source = host.querySelector<HTMLCanvasElement>(".hero-latent[data-ready] canvas");
    const context = source ? canvas.getContext("2d") : null;
    if (!source || !context) {
      canvas.style.display = "none";
      return;
    }
    canvas.width = source.width;
    canvas.height = source.height;
    context.drawImage(source, 0, 0);
  }, [plate]);

  const layout = boxes ? introLayout(boxes.stage, boxes.photo, vertical) : null;
  const grown = phase === "grow" || phase === "out";
  // 字ごとに少しずつ遅らせる。長い名前でも、最後の字が 0.72 秒より後にならないようにする。
  const step = Math.min(180, 720 / Math.max(1, chars.length - 1));

  return (
    <div ref={rootRef} className="dv-intro" data-phase={phase} aria-hidden="true">
      {layout && boxes && plate && (
        <div
          className="dv-intro__plate"
          style={{
            left: boxes.photo.x,
            top: boxes.photo.y,
            width: boxes.photo.w,
            height: boxes.photo.h,
            background: plate.ground,
            transform: grown
              ? "none"
              : `translate(${layout.plate.dx}px, ${layout.plate.dy}px) scale(${layout.plate.scale})`,
          }}
        >
          <img
            src={plate.src}
            alt=""
            decoding="sync"
            draggable={false}
            style={{ objectFit: plate.fit as never, objectPosition: plate.position }}
          />
          <canvas
            ref={latentRef}
            className="dv-intro__latent"
            style={{ objectFit: plate.fit as never, objectPosition: plate.position }}
          />
        </div>
      )}
      {layout && chars.length > 0 && (
        <p
          className="dv-intro__name"
          data-vertical={vertical ? "" : undefined}
          style={{ left: layout.name.left, top: layout.name.top, fontSize: layout.name.fontSize }}
        >
          {chars.map((char, i) => (
            // 並びは変わらない（名前の字を順に置くだけ）。
            // eslint-disable-next-line react/no-array-index-key
            <span key={i} style={{ animationDelay: `${150 + i * step}ms` }}>
              {char === " " ? " " : char}
            </span>
          ))}
        </p>
      )}
      {layout && caption && (
        <p className="dv-intro__caption" style={{ left: layout.caption.left, top: layout.caption.top }}>
          <span>{caption}</span>
        </p>
      )}
    </div>
  );
}
