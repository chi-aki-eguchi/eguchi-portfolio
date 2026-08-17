import {
  lazy,
  Suspense,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { PhotoGallery, type GalleryPhoto } from "../components/PhotoGallery";
import { InquiryCta } from "../components/InquiryCta";
import { ContentStatus } from "../components/ContentStatus";
import { SeriesStream } from "../components/SeriesStream";
import { num } from "../lib/utils";
import { shuffleWithSeed, visitShuffleSeed } from "../lib/shuffle";
import {
  clampSetting,
  clampSettingRounded,
} from "../../shared/setting-ranges";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { photoAltText } from "../../shared/photo-alt";
import { isServiceOwnerSite } from "../../shared/service-visibility";

const PortfolioKitExperience = lazy(
  () => import("../components/PortfolioKitExperience"),
);

function HeroPicture({
  url,
  mediumUrl,
  rotationDeg,
  focalX,
  focalY,
  alt,
  sizes,
  className,
  style,
  decoding,
  fetchPriority,
  loading,
  onError,
  draggable,
}: {
  url: string;
  mediumUrl?: string | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  alt: string;
  sizes: string;
  className?: string;
  style?: React.CSSProperties;
  decoding?: "sync" | "async";
  fetchPriority?: "high" | "low";
  loading?: "lazy" | "eager";
  onError?: React.ReactEventHandler<HTMLImageElement>;
  draggable?: boolean;
}) {
  const imgStyle = {
    ...style,
    objectPosition:
      style?.objectPosition ?? objectPositionFromFocal(focalX, focalY),
  };
  const finalSrc = mediumUrl ?? srcFor(url, 1536, 88, undefined, rotationDeg);
  return (
    <picture>
      {!mediumUrl && (
        <>
          <source
            type="image/avif"
            srcSet={srcSetFor(url, "hero", "avif", rotationDeg)}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={srcSetFor(url, "hero", "webp", rotationDeg)}
            sizes={sizes}
          />
        </>
      )}
      <img
        src={finalSrc}
        srcSet={
          mediumUrl ? undefined : srcSetFor(url, "hero", undefined, rotationDeg)
        }
        sizes={sizes}
        alt={alt}
        className={className}
        style={imgStyle}
        decoding={decoding}
        fetchPriority={fetchPriority}
        loading={loading}
        onError={onError}
        draggable={draggable}
      />
    </picture>
  );
}

type HomeHeroPhoto = {
  url: string;
  title: string;
  mediumUrl?: string | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
};

/** Hero carousel with auto-play, swipe, and arrow navigation */
function HeroCarousel({
  photos,
  fxRef,
  photographerName,
  loading = false,
}: {
  photos: HomeHeroPhoto[];
  fxRef?: React.Ref<HTMLDivElement>;
  photographerName?: string;
  /** まだ読み込み中か。読み込み中と「本当に0枚」を分けるために要る。 */
  loading?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isHovering, setIsHovering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Pause autoplay on hover OR keyboard focus (WCAG 2.2.2: moving content pausable).
  const paused = isHovering || isFocused;
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const touchRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
  } | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Respect the OS "reduce motion" setting — don't auto-advance for those users
  // (WCAG 2.2.2: moving content must be pausable; reduced-motion = keep it still).
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection("right");
      setCurrent((c) => (c + 1) % photos.length);
    }, 5000);
  }, [photos.length]);

  useEffect(() => {
    if (photos.length <= 1 || paused || prefersReducedMotion) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [photos.length, resetTimer, paused, prefersReducedMotion]);

  const goNext = useCallback(() => {
    setDirection("right");
    setCurrent((c) => (c + 1) % photos.length);
    resetTimer();
  }, [photos.length, resetTimer]);

  const goPrev = useCallback(() => {
    setDirection("left");
    setCurrent((c) => (c - 1 + photos.length) % photos.length);
    resetTimer();
  }, [photos.length, resetTimer]);

  const goTo = (idx: number) => {
    setDirection(idx > current ? "right" : "left");
    setCurrent(idx);
    resetTimer();
  };

  // Touch/swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  // A swipe that navigated must not also fire the click-to-advance handler
  // (touchend is followed by a synthetic click on most mobile browsers).
  const suppressClickRef = useRef(false);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchRef.current.startX;
      const dy = touch.clientY - touchRef.current.startY;
      const dt = Date.now() - touchRef.current.startTime;
      touchRef.current = null;

      // Must be mostly horizontal swipe, and either > 50px or fast flick
      if (
        Math.abs(dx) > Math.abs(dy) * 1.2 &&
        (Math.abs(dx) > 50 || (Math.abs(dx) > 20 && dt < 250))
      ) {
        suppressClickRef.current = true;
        if (dx < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev],
  );

  // Z1: クリック（タップ）でも次の写真へ。スワイプ直後の合成クリックは無視。
  const onClickAdvance = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (photos.length > 1) goNext();
  }, [photos.length, goNext]);

  // Keyboard support — window level so it works without focus.
  // Bail while a modal (lightbox) has locked body scroll, so arrow keys
  // don't drive the hero behind the open lightbox.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.body.style.overflow === "hidden") return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // 読み込み中は場所を取っておく（あとから写真が入って本文が飛ぶのを防ぐ）。
  // **読み込みが終わって0枚だったら、何も置かない。** 以前はここも同じ
  // 60vh の灰色の板を出していたので、買った直後のまだ写真が無いサイトでは、
  // トップページが 1440×540 の空の灰色の四角だけになっていた（実測）。
  // 意味のない箱を見せないこと（admin-renewal-goal 到達点(6)）。
  if (photos.length === 0)
    return loading ? (
      <div className="w-full" style={{ height: "60vh" }}>
        <div className="w-full h-full bg-[var(--photo-placeholder)] rounded-lg" />
      </div>
    ) : null;

  return (
    // The autoplay-pause handlers below sit on the carousel container on purpose so
    // hovering/focusing anywhere in it (photo, arrows, dots) pauses — moving them to
    // the inner photo button would make the hover-reveal arrows vanish the instant
    // the pointer reached them. They're presentational (pause moving content, WCAG
    // 2.2.2), so this interactivity rule is a false positive here.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      className="hero-carousel"
      ref={containerRef}
      aria-roledescription="カルーセル"
      aria-label="作品スライド"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div
        className="hero-carousel-inner hero-carousel-contain"
        // Z1: swipe + click/keyboard advance — only interactive when there is
        // somewhere to advance to (single-photo heroes stay a plain image).
        {...(photos.length > 1
          ? {
              onTouchStart,
              onTouchEnd,
              onClick: onClickAdvance,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickAdvance();
                }
              },
              role: "button",
              tabIndex: 0,
              "aria-label": "次の写真へ",
              title: "クリックで次の写真",
              style: { cursor: "pointer" },
            }
          : {})}
      >
        {/* AA3: scroll-effect layer — transform/opacity only, clipped by the box */}
        <div ref={fxRef} className="hero-fx-layer absolute inset-0">
          <div className="hero-photo-reveal absolute inset-0">
            {/* Main photo layer — contain, no crop */}
            {photos.map((p, i) => (
              <div
                key={i}
                className={`hero-slide hero-slide-contain ${i === current ? `active slide-${direction}` : ""}`}
                style={{ zIndex: i === current ? 1 : 0 }}
              >
                <HeroPicture
                  url={p.url}
                  mediumUrl={p.mediumUrl}
                  rotationDeg={p.rotationDeg}
                  focalX={p.focalX}
                  focalY={p.focalY}
                  alt={photoAltText(p, { photographerName })}
                  sizes="(min-width: 1200px) 1152px, 100vw"
                  className="w-full h-full object-contain"
                  decoding={i === 0 ? "sync" : "async"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility =
                      "hidden";
                  }}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Arrow buttons (PC) — outside overflow:hidden container */}
      {photos.length > 1 && (
        <>
          <button
            className={`carousel-arrow carousel-arrow-left ${paused ? "visible" : ""}`}
            onClick={goPrev}
            aria-label="前のスライド"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className={`carousel-arrow carousel-arrow-right ${paused ? "visible" : ""}`}
            onClick={goNext}
            aria-label="次のスライド"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators + progress bar. gap-0: each dot already carries 8px of
          transparent tap-padding, so visible spacing stays quiet. */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-0 mt-4">
          {photos.map((_, i) => (
            <button
              key={i}
              className={`carousel-dot ${i === current ? "active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** E1: single hero — one large photo with the name overlaid.
 *  AA2: titlePosition places the caption; AA3: fxRef is the scroll-effect layer
 *  (photo + overlay move/fade together, the caption stays put). */
function HeroSingle({
  photo,
  children,
  titlePosition = "center",
  fxRef,
  photographerName,
}: {
  photo: HomeHeroPhoto;
  children?: React.ReactNode;
  titlePosition?: string;
  fxRef?: React.Ref<HTMLDivElement>;
  photographerName?: string;
}) {
  const posClass = [
    "bottom-left",
    "bottom-right",
    "top-left",
    "top-right",
  ].includes(titlePosition)
    ? `pos-${titlePosition}`
    : "";
  const overlayTop = titlePosition.startsWith("top-") ? "overlay-top" : "";
  return (
    <div className="hero-single">
      <div ref={fxRef} className="hero-fx-layer absolute inset-0">
        <div className="hero-photo-reveal absolute inset-0">
          <HeroPicture
            url={photo.url}
            mediumUrl={photo.mediumUrl}
            rotationDeg={photo.rotationDeg}
            focalX={photo.focalX}
            focalY={photo.focalY}
            alt={photoAltText(photo, { photographerName })}
            sizes="100vw"
            className="hero-single-img"
            decoding="sync"
            fetchPriority="high"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
            draggable={false}
          />
          <div className={`hero-single-overlay ${overlayTop}`} />
        </div>
      </div>
      <div className={`hero-single-caption ${posClass}`}>{children}</div>
    </div>
  );
}

type HomeLayoutProps = {
  heroPhotos: HomeHeroPhoto[];
  featured: GalleryPhoto[];
  worksPoolLen: number;
  worksSentinelRef: React.RefObject<HTMLDivElement | null>;
  fadeRef: React.Ref<HTMLDivElement>;
  settings: Record<string, string | undefined> | undefined;
  // The hero scroll effect writes transforms onto fxRef and measures heroBoxRef.
  // Every layout passes them through so 「スクロール効果」 is not silently inert
  // on whichever hero the owner happens to have chosen.
  heroFxRef: React.Ref<HTMLDivElement>;
  heroBoxRef: React.Ref<HTMLElement>;
  /** Rendered in place of the Works section when there is nothing to show yet.
   *  Empty means "genuinely no photos"; loading and failure say so instead of
   *  leaving the visitor looking at a site that appears to have no work. */
  worksStatus: React.ReactNode;
};

/**
 * TOP のシリーズ帯を、置き場所の設定に合わせて出す。Hero の種類は5つあり、
 * どれを選んでいても同じように出したいので、ここで1つにまとめて各レイアウト
 * から Works の前後2箇所に置く。`off` のときは何も出さない。
 */
function TopSeriesStream({
  settings,
  at,
}: {
  settings: Record<string, string | undefined> | undefined;
  at: "before-works" | "after-works";
}) {
  const placement = settings?.topSeriesStream ?? "after-works";
  if (placement !== at) return null;
  return (
    <SeriesStream
      label={settings?.topSeriesStreamLabel || "Series"}
      showCaption={(settings?.topSeriesStreamCaption ?? "on") !== "off"}
      speedPxPerSec={clampSetting(
        "topSeriesStreamSpeed",
        num(settings?.topSeriesStreamSpeed, 34),
      )}
      tileHeight={clampSettingRounded(
        "topSeriesStreamHeight",
        num(settings?.topSeriesStreamHeight, 260),
      )}
    />
  );
}

/**
 * TOP に作家自身の言葉を置く。写真しか無いトップページはどれも似るので、
 * 「その人が何を撮っているか」を本人の文で出せるようにする。
 *
 * **文章は新しく入力させない。** Profile の作家ステートメント
 * （`profileStatement`）をそのまま使う。同じ文を2箇所へ書かせると必ず片方が
 * 古くなる。だから設定は「どこに出すか」だけ。書いていなければ何も出ない。
 *
 * 見出しは付けない。ラベルを足すほど読む量が増えて逆に読まれないので、
 * 言葉だけを大きめの行送りで置く（design-spec「足すより、間を作る」）。
 */
function TopStatement({
  settings,
  at,
}: {
  settings: Record<string, string | undefined> | undefined;
  at: "before-works" | "after-works";
}) {
  const placement = settings?.homeStatement ?? "off";
  if (placement !== at) return null;
  // TOP に英語ルートは無い（/en は about と contact だけ）ので出し分けは要らない。
  const text = settings?.profileStatement ?? "";
  if (!text.trim()) return null;
  return (
    <section className="max-w-2xl mx-auto px-6 md:px-12 pb-[calc(3rem*var(--spacing-section-gap,1))] md:pb-[calc(5rem*var(--spacing-section-gap,1))]">
      <div className="space-y-4 section-reveal">
        {text
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p
              key={i}
              className="text-[color:var(--text-quiet)] text-pretty break-words ja-prose"
              style={{
                fontSize: "var(--body-size, 0.9375rem)",
                lineHeight: "var(--body-leading, 2.1)",
                letterSpacing: "var(--body-tracking, 0.02em)",
              }}
            >
              {para.replace(/\n/g, " ")}
            </p>
          ))}
      </div>
    </section>
  );
}

function heroMotionKey(
  settings: Record<string, string | undefined> | undefined,
): string {
  return `${settings?.heroMotionSpeed || "standard"}:${settings?.heroRevealOrder || "photo-first"}`;
}

/** Hero height for the alternative Home layouts.
 *
 * `--hero-height` is the admin slider in raw vh. The fixed header sits above the
 * hero (main has padding-top: var(--header-h)), so a literal 100vh hangs exactly
 * one header below the fold. Cap at the visible area — the same correction
 * `.hero-fullscreen` makes in styles.css — so "100" reads as "one screenful".
 * `fallback` is the height that layout used before the slider reached it, so an
 * unset site is unchanged. */
function heroHeightValue(fallback: string): string {
  return `min(var(--hero-height, ${fallback}), calc(100svh - var(--header-h) - var(--sai-top)))`;
}

/** The hero name block, shared by every Hero mode.
 *
 * The three alternative layouts below (quiet-grid / editorial / immersive) used
 * to hardcode their own font sizes, weights, colours and tracking, so the whole
 * 「ヒーロー」/「文字の色」settings group silently did nothing whenever one of
 * them was selected. They all render this instead now.
 *
 * `tone` decides how far the settings reach. Over a photo the colour pickers are
 * deliberately ignored and white + a shadow is used, because an arbitrary
 * foreground colour over an arbitrary photo is not readable — this is the same
 * rule the default (carousel / single) hero already followed. Size, weight and
 * tracking apply in both tones. Each `var()` fallback is the value that tone
 * rendered before, so an unset site looks unchanged.
 */
function HeroNameBlock({
  settings,
  tone,
  nameSizeFallback,
  nameTrackingFallback = "0.04em",
  enSizeFallback = "var(--text-note)",
  enTrackingFallback = "0.08em",
  showKata = true,
}: {
  settings: Record<string, string | undefined> | undefined;
  tone: "over-photo" | "on-paper";
  nameSizeFallback: string;
  nameTrackingFallback?: string;
  enSizeFallback?: string;
  enTrackingFallback?: string;
  showKata?: boolean;
}) {
  const overPhoto = tone === "over-photo";
  const siteNameJa = settings?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const siteNameEn = settings?.siteNameEn ?? CLIENT_SITE_FALLBACKS.siteNameEn;
  const nameKata = settings?.profileNameKata ?? "";
  const subtitle = settings?.heroSubtitle ?? CLIENT_SITE_FALLBACKS.heroSubtitle;

  const shadow = (blur: number) =>
    overPhoto ? `0 1px ${blur}px rgba(0,0,0,0.4)` : undefined;

  return (
    <>
      <h1
        className="font-serif leading-tight break-words hero-text-reveal hero-text-reveal-1"
        style={{
          fontSize: `var(--hero-name-size, ${nameSizeFallback})`,
          fontWeight: "var(--hero-name-weight, 300)" as never,
          color: overPhoto ? "#fff" : "var(--hero-name-color, var(--foreground))",
          letterSpacing: `var(--hero-name-tracking, ${nameTrackingFallback})`,
          textShadow: shadow(8),
        }}
      >
        {siteNameJa}
      </h1>
      {showKata && nameKata && (
        <p
          className="text-[length:var(--text-note)] tracking-[0.18em] mt-1.5 break-words hero-text-reveal hero-text-reveal-2"
          style={{
            color: overPhoto ? "rgba(255,255,255,0.70)" : "var(--text-quiet)",
            textShadow: shadow(12),
          }}
        >
          {nameKata}
        </p>
      )}
      <p
        className="font-en uppercase mt-1 hero-text-reveal hero-text-reveal-2"
        style={{
          fontSize: `var(--hero-name-en-size, ${enSizeFallback})`,
          color: overPhoto
            ? "rgba(255,255,255,0.82)"
            : "var(--hero-name-en-color, var(--text-quiet))",
          letterSpacing: `var(--hero-name-en-tracking, ${enTrackingFallback})`,
          textShadow: shadow(14),
        }}
      >
        {siteNameEn}
      </p>
      {subtitle && (
        <p
          className="font-en tracking-[0.10em] mt-1 break-words hero-text-reveal hero-text-reveal-3"
          style={{
            fontSize: "var(--hero-sub-size, 0.75rem)",
            color: overPhoto
              ? "rgba(255,255,255,0.62)"
              : "var(--hero-sub-color, var(--text-quiet))",
            textShadow: shadow(12),
          }}
        >
          {subtitle}
        </p>
      )}
    </>
  );
}

/** The Works section header (label + "View all" link), shared by the
 * alternative Home layouts. `worksLabel` / `viewAllLabel` used to be missing
 * from editorial and immersive, so those two admin fields did nothing there. */
function WorksHeader({
  settings,
}: {
  settings: Record<string, string | undefined> | undefined;
}) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <h2
        className="font-en uppercase"
        style={{
          fontSize: "var(--section-label-size, var(--text-caption))",
          letterSpacing: "var(--section-label-tracking, 0.16em)",
          color: "var(--section-label-color)",
        }}
      >
        {settings?.worksLabel ?? "Works"}
      </h2>
      <Link
        to="/gallery"
        className="tap-target font-en transition-colors duration-300 hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))]"
        style={{
          fontSize: "var(--section-label-size, var(--text-caption))",
          letterSpacing: "var(--section-label-tracking, 0.06em)",
          color: "var(--section-label-color)",
        }}
      >
        {settings?.viewAllLabel ?? "View all →"}
      </Link>
    </div>
  );
}

/** Phase 2 — Home A: quiet hero photo + clean 3-column square grid.
 * Works grid honours topWorksLayout (falls back to clean-grid, its original
 * look) — previously hardcoded, which silently ignored the admin's ギャラリー
 * 配置→Top picker whenever this Hero mode was selected (2026-07-09). */
function HomeQuietGrid({
  heroPhotos,
  featured,
  worksPoolLen,
  worksSentinelRef,
  fadeRef,
  settings,
  heroFxRef,
  heroBoxRef,
  worksStatus,
}: HomeLayoutProps) {
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const heroPhoto = heroPhotos[0];

  return (
    <div className="top-page" data-hero-mode="quiet-grid">
      {/* Hero: full-width photo with name overlay at bottom-left */}
      <section
        key={heroMotionKey(settings)}
        ref={heroBoxRef}
        className="hero-motion-stage relative w-full overflow-hidden"
        style={{ height: heroHeightValue("min(280px, 50vh)") }}
      >
        {heroPhoto ? (
          <>
            <div ref={heroFxRef} className="hero-fx-layer hero-photo-reveal absolute inset-0">
              <HeroPicture
                url={heroPhoto.url}
                mediumUrl={heroPhoto.mediumUrl}
                rotationDeg={heroPhoto.rotationDeg}
                focalX={heroPhoto.focalX}
                focalY={heroPhoto.focalY}
                alt={photoAltText(heroPhoto, { photographerName })}
                sizes="100vw"
                className="w-full h-full object-cover"
                decoding="sync"
                fetchPriority="high"
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility =
                    "hidden";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="absolute bottom-6 left-7 right-7">
              <HeroNameBlock
                settings={settings}
                tone="over-photo"
                nameSizeFallback="32px"
                nameTrackingFallback="0.02em"
                enTrackingFallback="0.14em"
                showKata={false}
              />
            </div>
          </>
        ) : (
          <div className="hero-photo-reveal w-full h-full bg-[var(--photo-placeholder)]" />
        )}
      </section>

      <TopSeriesStream settings={settings} at="before-works" />
      <TopStatement settings={settings} at="before-works" />

      {/* Works: 3-column square grid */}
      {featured.length === 0 && worksStatus}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-5 pb-20"
          ref={fadeRef}
        >
          <WorksHeader settings={settings} />

          <PhotoGallery
            photos={featured}
            layoutType={settings?.topWorksLayout ?? "clean-grid"}
            variant="top"
          />

          {featured.length < worksPoolLen && (
            <div
              ref={worksSentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />
          )}

          <div className="mt-16 md:mt-24 text-center section-reveal">
            <Link
              to="/gallery"
              className="inline-block max-w-full break-words font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[color:var(--text-quiet)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <TopSeriesStream settings={settings} at="after-works" />
      <TopStatement settings={settings} at="after-works" />

      <InquiryCta />
    </div>
  );
}

/** Phase 2 — Home B: split hero + alternating large/small rhythm grid.
 * Works grid honours topWorksLayout (falls back to editorial, its original
 * look) — previously hardcoded, which silently ignored the admin's ギャラリー
 * 配置→Top picker whenever this Hero mode was selected (2026-07-09). */
function HomeEditorial({
  heroPhotos,
  featured,
  worksPoolLen,
  worksSentinelRef,
  fadeRef,
  settings,
  heroFxRef,
  heroBoxRef,
  worksStatus,
}: HomeLayoutProps) {
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const statement = settings?.profileStatement ?? "";
  const heroPhoto = heroPhotos[0];

  return (
    <div className="top-page" data-hero-mode="editorial">
      {/* Split hero: photo left, text right */}
      <section
        key={heroMotionKey(settings)}
        ref={heroBoxRef}
        className="hero-motion-stage flex flex-col md:flex-row"
        style={{ minHeight: heroHeightValue("min(340px, 50vh)") }}
      >
        <div
          ref={heroFxRef}
          className="hero-fx-layer hero-photo-reveal md:flex-[0_0_55%] relative overflow-hidden bg-[var(--photo-placeholder)]"
          style={{ minHeight: 200 }}
        >
          {heroPhoto && (
            <HeroPicture
              url={heroPhoto.url}
              mediumUrl={heroPhoto.mediumUrl}
              rotationDeg={heroPhoto.rotationDeg}
              focalX={heroPhoto.focalX}
              focalY={heroPhoto.focalY}
              alt={photoAltText(heroPhoto, { photographerName })}
              sizes="(min-width: 768px) 55vw, 100vw"
              className="w-full h-full object-cover"
              decoding="sync"
              fetchPriority="high"
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
              }}
            />
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center px-8 md:px-10 py-8 md:py-0">
          <HeroNameBlock
            settings={settings}
            tone="on-paper"
            nameSizeFallback="clamp(28px, 4vw, 36px)"
            nameTrackingFallback="0.01em"
            enSizeFallback="var(--text-small)"
            enTrackingFallback="0.06em"
          />
          {statement && (
            <p
              className="font-ja mt-5 hero-text-reveal hero-text-reveal-3"
              style={{
                fontSize: "var(--text-note)",
                color: "var(--text-quiet)",
                lineHeight: "var(--body-leading, 1.8)",
                maxWidth: 260,
              }}
            >
              {statement}
            </p>
          )}
        </div>
      </section>

      <TopSeriesStream settings={settings} at="before-works" />
      <TopStatement settings={settings} at="before-works" />

      {/* Works: alternating large/small rhythm grid */}
      {featured.length === 0 && worksStatus}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-5 pb-20"
          ref={fadeRef}
        >
          <WorksHeader settings={settings} />

          <PhotoGallery
            photos={featured}
            layoutType={settings?.topWorksLayout ?? "editorial"}
            variant="top"
          />

          {featured.length < worksPoolLen && (
            <div
              ref={worksSentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />
          )}

          <div className="mt-16 md:mt-24 text-center section-reveal">
            <Link
              to="/gallery"
              className="inline-block max-w-full break-words font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[color:var(--text-quiet)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <TopSeriesStream settings={settings} at="after-works" />
      <TopStatement settings={settings} at="after-works" />

      <InquiryCta />
    </div>
  );
}

/** Phase 2 — Home C: fullscreen hero with centered name + large-format works. */
function HomeImmersive({
  heroPhotos,
  featured,
  worksPoolLen,
  worksSentinelRef,
  fadeRef,
  settings,
  heroFxRef,
  heroBoxRef,
  worksStatus,
}: HomeLayoutProps) {
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const heroPhoto = heroPhotos[0];

  // Scroll-hint fade: hide the arrow once the user starts scrolling
  const hintRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = hintRef.current;
    if (!el) return;
    const onScroll = () => {
      el.style.opacity = window.scrollY > 60 ? "0" : "1";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="top-page" data-hero-mode="immersive">
      {/* Fullscreen hero with centered name. Header is fixed+opaque (not an
          overlay) so its footprint must be subtracted from the viewport
          height — see .hero-fullscreen in styles.css for the same fix. */}
      <section
        key={heroMotionKey(settings)}
        ref={heroBoxRef}
        className="hero-motion-stage relative w-full overflow-hidden"
        style={{
          height: heroHeightValue(
            "calc(100dvh - var(--header-h) - var(--sai-top))",
          ),
        }}
      >
        <div ref={heroFxRef} className="hero-fx-layer hero-photo-reveal absolute inset-0">
          {heroPhoto ? (
            <HeroPicture
              url={heroPhoto.url}
              mediumUrl={heroPhoto.mediumUrl}
              rotationDeg={heroPhoto.rotationDeg}
              focalX={heroPhoto.focalX}
              focalY={heroPhoto.focalY}
              alt={photoAltText(heroPhoto, { photographerName })}
              sizes="100vw"
              className="w-full h-full object-cover"
              decoding="sync"
              fetchPriority="high"
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  "hidden";
              }}
            />
          ) : (
            <div className="w-full h-full bg-[#2a3a3a]" />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>
        {/* Centered name */}
        <div className="absolute inset-0 flex items-center justify-center text-center px-6">
          <div>
            <HeroNameBlock
              settings={settings}
              tone="over-photo"
              nameSizeFallback="clamp(32px, 5vw, 40px)"
              nameTrackingFallback="0.06em"
              enTrackingFallback="0.2em"
            />
          </div>
        </div>
        {/* Scroll hint */}
        <div
          ref={hintRef}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-opacity duration-500"
        >
          <div className="w-px h-5 bg-white/40" />
          <div
            className="w-1.5 h-1.5 border-r border-b border-white/50"
            style={{ transform: "rotate(45deg)" }}
          />
        </div>
      </section>

      <TopSeriesStream settings={settings} at="before-works" />
      <TopStatement settings={settings} at="before-works" />

      {/* Large-format works with captions */}
      {featured.length === 0 && worksStatus}
      {featured.length > 0 && (
        <section
          className="max-w-4xl mx-auto px-6 md:px-12 pt-6 pb-20"
          ref={fadeRef}
        >
          <WorksHeader settings={settings} />

          <PhotoGallery
            photos={featured}
            layoutType={settings?.topWorksLayout ?? "large-format"}
            variant="top"
          />

          {featured.length < worksPoolLen && (
            <div
              ref={worksSentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />
          )}

          <div className="mt-16 md:mt-24 text-center section-reveal">
            <Link
              to="/gallery"
              className="inline-block max-w-full break-words font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[color:var(--text-quiet)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <TopSeriesStream settings={settings} at="after-works" />
      <TopStatement settings={settings} at="after-works" />

      <InquiryCta />
    </div>
  );
}

export default function TopPage() {
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const topWorksMode = settings?.topWorksMode || "auto";
  const homeGalleryCount = Math.max(
    1,
    parseInt(settings?.homeGalleryCount ?? "12", 10) || 12,
  );
  const WORKS_STEP = 9;
  const topRandomLimit = Math.min(
    60,
    Math.max(homeGalleryCount + WORKS_STEP * 4, 36),
  );
  const {
    data: photosData,
    isLoading: photosLoading,
    isError: photosFailed,
    error: photosErrorObj,
    refetch: refetchPhotos,
  } = useQuery({
    queryKey:
      topWorksMode === "random"
        ? ["photos", "top-random", topRandomLimit]
        : ["photos"],
    queryFn: async () => {
      if (topWorksMode === "random") {
        return jsonOrThrow(
          await api.photos.$get({
            query: { limit: String(topRandomLimit), order: "random" },
          }),
        );
      }
      return jsonOrThrow(await api.photos.$get());
    },
    enabled: !settingsLoading,
  });
  const { data: heroData, isLoading: heroLoading } = useQuery({
    queryKey: ["hero-photos"],
    queryFn: async () => jsonOrThrow(await api["hero-photos"].$get()),
  });

  // Stable reference across renders so the `featured` useMemo doesn't recompute every render.
  const allPhotos = useMemo(
    () =>
      topWorksMode === "random"
        ? (photosData?.photos ?? [])
        : sortPhotosBySetting(
            photosData?.photos ?? [],
            settings?.gallerySortOrder,
          ),
    [photosData, settings?.gallerySortOrder, topWorksMode],
  );
  // The API may return null entries for hero rows whose photo was deleted.
  const heroPhotosPicked = (heroData?.heroPhotos ?? []).filter(
    (p): p is NonNullable<typeof p> => p != null,
  );
  // Don't fall back to gallery photos while hero-photos is still loading —
  // that would briefly flash unrelated photos in the hero before the real ones arrive.
  const heroBase = useMemo(
    () =>
      heroPhotosPicked.length > 0
        ? heroPhotosPicked
        : heroLoading
          ? []
          : allPhotos.slice(0, 5),
    // heroPhotosPicked は heroData から作る派生値なので、素の heroData で見る。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroData, heroLoading, allPhotos],
  );
  // HERO のランダム（2026-08-09 オーナー依頼「両方選べるように」）。
  //  - off（既定）: 選んだHERO写真を、選んだ順で出す。今までどおり
  //  - shuffle: 選んだHERO写真はそのまま、順番だけ訪問ごとに変える
  //  - any: HERO の登録と関係なく、公開中の写真全体から訪問ごとに選ぶ
  // 種は訪問ごとに1回だけ決める。写真が追加で読み込まれるたびに引き直すと、
  // 見ている最中にヒーローの写真が入れ替わってしまう。
  const heroRandom = settings?.heroRandom ?? "off";
  const pickedCount = heroPhotosPicked.length;
  // 全体から選ぶときだけ、公開写真すべてを1回並べ替えて持っておく。
  // 497枚の並べ替えを毎レンダーやる必要はない。
  const heroPoolShuffled = useMemo(
    () =>
      heroRandom === "any" ? shuffleWithSeed(allPhotos, visitShuffleSeed()) : null,
    [heroRandom, allPhotos],
  );
  const heroPhotos = useMemo(() => {
    if (heroRandom === "any" && heroPoolShuffled && heroPoolShuffled.length > 0) {
      return heroPoolShuffled.slice(0, Math.max(1, pickedCount || 5));
    }
    if (heroRandom === "shuffle" && heroBase.length > 1) {
      return shuffleWithSeed(heroBase, visitShuffleSeed());
    }
    return heroBase;
    // heroBase を代理値（長さ・先頭URL）で見張ると、中身だけ入れ替わったときに
    // 古い配列を返し続ける。種は固定なので、実体を依存にして毎回引き直しても
    // 結果は同じ。並べ替えるのは多くて5枚なので費用も無い。
  }, [heroRandom, heroPoolShuffled, heroBase, pickedCount]);
  // Top Works pool honours topWorksMode:
  //  - auto (default): the whole library in Aki's order (design-spec 2-2 — the
  //    manual sortOrder × size composition flows into the top page as-is)
  //  - random: the whole library reshuffled per visit (stable within the visit)
  //  - manual: exactly the photos picked in admin, in picked order; falls back
  //    to auto while nothing is picked so the section never goes blank.
  // The pool reveals progressively as you scroll (Works infinite-feed): the page
  // starts with one composed screenful and keeps the 作品がどんどん出てくる
  // rhythm going without a click — the gallery CTA below stays as a destination.
  const topWorksIds = settings?.topWorksIds || "";
  const worksPool = useMemo(() => {
    if (topWorksMode === "manual") {
      // Dedupe IDs: the admin enters topWorksIds as free-text CSV, and a repeated
      // ID would map to the same photo object twice — PhotoGallery keys tiles by
      // photo.id, so duplicates trigger a React key collision (a tile vanishes /
      // its reveal transition breaks). Set preserves first-seen order.
      const ids = [
        ...new Set(
          topWorksIds
            .split(",")
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Number.isFinite),
        ),
      ];
      const byId = new Map(allPhotos.map((p) => [p.id, p]));
      const picked = ids
        .map((id: number) => byId.get(id))
        .filter((p): p is (typeof allPhotos)[number] => Boolean(p));
      if (picked.length > 0) return picked; // curated set only — no auto-append
    } else if (topWorksMode === "random") {
      const arr = [...allPhotos];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    return allPhotos;
  }, [allPhotos, topWorksMode, topWorksIds]);

  // homeGalleryCount: initial batch from settings (default 12).
  // extraCount: additional photos revealed by infinite scroll.
  // worksCount = homeGalleryCount + extraCount — never shrinks while browsing.
  const [extraCount, setExtraCount] = useState(0);
  const worksCount = homeGalleryCount + extraCount;
  const worksSentinelRef = useRef<HTMLDivElement>(null);
  const featured = useMemo(
    () => worksPool.slice(0, worksCount),
    [worksPool, worksCount],
  );
  useEffect(() => {
    if (worksCount >= worksPool.length) return; // everything shown — stop observing
    const el = worksSentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setExtraCount((c) => c + WORKS_STEP);
        }
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [worksCount, worksPool.length]);
  const siteNameJa = settings?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const siteNameEn = settings?.siteNameEn ?? CLIENT_SITE_FALLBACKS.siteNameEn;
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const subtitle = settings?.heroSubtitle ?? CLIENT_SITE_FALLBACKS.heroSubtitle;
  const fadeRef = useScrollFadeIn([featured, settings?.topWorksLayout]);
  const nameKata = settings?.profileNameKata ?? "";
  const heroMode = settings?.heroMode ?? "carousel";

  const isSingle = heroMode === "single" && heroPhotos.length > 0;
  const heroFullscreen =
    (settings?.heroDisplayMode || "normal") === "fullscreen";
  const heroTitlePosition = settings?.heroTitlePosition || "center";
  const heroScrollEffect = settings?.heroScrollEffect || "none";

  const heroFxRef = useRef<HTMLDivElement>(null);
  const heroBoxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = heroFxRef.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (heroScrollEffect === "none" || reduced) {
      el.style.transform = "";
      el.style.opacity = "";
      return;
    }
    let raf = 0;
    const apply = () => {
      raf = 0;
      const layer = heroFxRef.current;
      const box = heroBoxRef.current;
      if (!layer || !box) return;
      const h = box.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, window.scrollY / h));
      if (heroScrollEffect === "fade") {
        layer.style.transform = "";
        layer.style.opacity = String(Math.max(0, 1 - p * 0.95));
      } else if (heroScrollEffect === "sink") {
        layer.style.transform = `translate3d(0, ${Math.round(window.scrollY * 0.45)}px, 0)`;
        layer.style.opacity = String(Math.max(0.55, 1 - p * 0.45));
      } else if (heroScrollEffect === "parallax") {
        layer.style.transform = `translate3d(0, ${Math.round(window.scrollY * 0.5)}px, 0)`;
        layer.style.opacity = "";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.opacity = "";
    };
    // heroPhotos.length matters: the fx layer does not exist until the hero
    // photos arrive, and without it this effect bailed on a null ref and never
    // re-ran. That left スクロール効果 dead in carousel mode — the default.
  }, [heroScrollEffect, isSingle, heroFullscreen, heroPhotos.length]);

  // Loading and failure used to render nothing at all, so a visitor on a slow
  // or broken connection saw a portfolio with no work in it. Say which it is.
  const worksStatus =
    featured.length > 0 ? null : photosLoading ? (
      <ContentStatus state="loading" />
    ) : photosFailed ? (
      <ContentStatus
        state="error"
        error={photosErrorObj}
        onRetry={() => void refetchPhotos()}
      />
    ) : null;

  const homeLayoutProps: HomeLayoutProps = {
    heroPhotos,
    featured,
    worksPoolLen: worksPool.length,
    worksSentinelRef,
    fadeRef,
    heroFxRef,
    heroBoxRef,
    worksStatus,
    settings,
  };

  const experienceRequested =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(
      "portfolio-kit-experience",
    ) === "1";
  const experienceEnabled =
    experienceRequested &&
    typeof window !== "undefined" &&
    isServiceOwnerSite(undefined, window.location.hostname);
  const experiencePanel = experienceEnabled && settings && (
    <Suspense fallback={null}>
      <PortfolioKitExperience initialSettings={settings} />
    </Suspense>
  );

  if (heroMode === "quiet-grid")
    return (
      <>
        <HomeQuietGrid {...homeLayoutProps} />
        {experiencePanel}
      </>
    );
  if (heroMode === "editorial")
    return (
      <>
        <HomeEditorial {...homeLayoutProps} />
        {experiencePanel}
      </>
    );
  if (heroMode === "immersive")
    return (
      <>
        <HomeImmersive {...homeLayoutProps} />
        {experiencePanel}
      </>
    );

  return (
    <div
      className="top-page"
      data-hero-mode={isSingle ? "single" : "carousel"}
    >
      {experiencePanel}
      {isSingle ? (
        /* Hero: single large photo with name overlaid */
        <section
          key={heroMotionKey(settings)}
          ref={heroBoxRef}
          className={`hero-motion-stage ${heroFullscreen ? "hero-fullscreen" : "pt-6 md:pt-10"}`}
        >
          <HeroSingle
            photo={heroPhotos[0]}
            titlePosition={heroTitlePosition}
            fxRef={heroFxRef}
            photographerName={photographerName}
          >
            <h1
              className="font-bold leading-tight break-words hero-text-reveal hero-text-reveal-1"
              style={{
                fontSize: "var(--hero-name-size, 1.75rem)",
                fontWeight: "var(--hero-name-weight, 700)" as never,
                color: "#fff",
                letterSpacing: "var(--hero-name-tracking, 0.04em)",
                textShadow: "0 1px 18px rgba(0,0,0,0.45)",
              }}
            >
              {siteNameJa}
            </h1>
            {nameKata && (
              <p
                className="text-[length:var(--text-note)] tracking-[0.18em] mt-1.5 break-words hero-text-reveal hero-text-reveal-2"
                style={{
                  color: "rgba(255,255,255,0.70)",
                  textShadow: "0 1px 12px rgba(0,0,0,0.4)",
                }}
              >
                {nameKata}
              </p>
            )}
            <p
              className="font-en mt-1 break-words hero-text-reveal hero-text-reveal-2"
              style={{
                fontSize: "var(--hero-name-en-size, 0.9375rem)",
                color: "rgba(255,255,255,0.82)",
                letterSpacing: "var(--hero-name-en-tracking, 0.08em)",
                textShadow: "0 1px 14px rgba(0,0,0,0.4)",
              }}
            >
              {siteNameEn}
            </p>
            <p
              className="font-en tracking-[0.10em] mt-1 break-words hero-text-reveal hero-text-reveal-3"
              style={{
                fontSize: "var(--hero-sub-size, 0.75rem)",
                color: "rgba(255,255,255,0.62)",
                textShadow: "0 1px 12px rgba(0,0,0,0.4)",
              }}
            >
              {subtitle}
            </p>
          </HeroSingle>
        </section>
      ) : (
        /* Hero: Carousel + Name block */
        <section
          key={heroMotionKey(settings)}
          ref={heroBoxRef}
          className={
            heroFullscreen
              ? "hero-motion-stage hero-fullscreen"
              : "hero-motion-stage max-w-6xl mx-auto px-4 md:px-10 pt-6 md:pt-10"
          }
        >
          <HeroCarousel
            photos={heroPhotos}
            fxRef={heroFxRef}
            photographerName={photographerName}
            loading={heroLoading || photosLoading}
          />

          {/* Name block below carousel. AA2: in carousel mode the title sits
              under the photos, so the position setting maps to text alignment. */}
          <div
            className={`mt-12 md:mt-16 mb-10 ${heroFullscreen ? "px-6" : ""} ${
              heroTitlePosition.endsWith("-left")
                ? "text-left"
                : heroTitlePosition.endsWith("-right")
                  ? "text-right"
                  : "text-center"
            }`}
          >
            <h1
              className="font-bold leading-tight break-words hero-text-reveal hero-text-reveal-1"
              style={{
                fontWeight: "var(--hero-name-weight, 700)" as never,
                fontSize: "var(--hero-name-size, 1.5rem)",
                color: "var(--hero-name-color, var(--foreground))",
                letterSpacing: "var(--hero-name-tracking, 0.04em)",
              }}
            >
              {siteNameJa}
            </h1>
            {nameKata && (
              <p className="text-[length:var(--text-note)] tracking-[0.18em] text-[color:var(--text-quiet)] mt-1.5 break-words hero-text-reveal hero-text-reveal-2">
                {nameKata}
              </p>
            )}
            <p
              className="font-en mt-1 break-words hero-text-reveal hero-text-reveal-2"
              style={{
                fontSize: "var(--hero-name-en-size, 0.875rem)",
                color:
                  "var(--hero-name-en-color, var(--text-quiet))",
                letterSpacing: "var(--hero-name-en-tracking, 0.08em)",
              }}
            >
              {siteNameEn}
            </p>
            <p
              className="font-en tracking-[0.10em] mt-1 break-words hero-text-reveal hero-text-reveal-3"
              style={{
                fontSize: "var(--hero-sub-size, 0.75rem)",
                color:
                  "var(--hero-sub-color, var(--text-quiet))",
              }}
            >
              {subtitle}
            </p>
          </div>
        </section>
      )}

      <TopSeriesStream settings={settings} at="before-works" />
      <TopStatement settings={settings} at="before-works" />

      {/* Photo Grid */}
      {featured.length === 0 && worksStatus}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(2rem*var(--spacing-hero-bottom,1))] md:pt-[calc(3rem*var(--spacing-hero-bottom,1))] pb-[calc(5rem*var(--spacing-section-gap,1))] md:pb-[calc(8rem*var(--spacing-section-gap,1))]"
          ref={fadeRef}
        >
          <div className="flex items-center justify-between mb-10 md:mb-14">
            <h2
              className="font-en uppercase section-reveal break-words min-w-0"
              style={{
                fontSize: "var(--section-label-size, 0.75rem)",
                color: "var(--section-label-color)",
                letterSpacing: "var(--section-label-tracking, 0.12em)",
                lineHeight: "var(--section-leading, 1.2)",
              }}
            >
              {settings?.worksLabel ?? "Works"}
            </h2>
            <Link
              to="/gallery"
              className="font-en hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.55))] transition-colors duration-300 nav-link-luxury section-reveal py-1.5 break-words shrink-0 max-w-[45%]"
              style={{
                transitionDelay: "0.1s",
                fontSize: "var(--section-label-size, 0.6875rem)",
                letterSpacing: "var(--section-label-tracking, 0.06em)",
                color: "var(--section-label-color)",
              }}
            >
              {settings?.viewAllLabel ?? "View all →"}
            </Link>
          </div>

          {/* N: top Works section honours topWorksLayout (default ずらし大 / stagger) */}
          <PhotoGallery
            photos={featured}
            layoutType={settings?.topWorksLayout ?? "stagger"}
            variant="top"
          />

          {/* Infinite-feed sentinel — fires ~900px before it scrolls into view. */}
          {featured.length < worksPool.length && (
            <div
              ref={worksSentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />
          )}

          {/* Works → Gallery funnel: a quiet but unmissable CTA after the photos,
              where the "もっと見たい" moment actually happens. The header's small
              "View all" link stays for orientation; this is the conversion path. */}
          <div className="mt-16 md:mt-24 text-center section-reveal">
            <Link
              to="/gallery"
              className="inline-block max-w-full break-words font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[color:var(--text-quiet)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      {/* Closing 撮影依頼 CTA — the homepage's conversion moment (off by default) */}
      <TopSeriesStream settings={settings} at="after-works" />
      <TopStatement settings={settings} at="after-works" />

      <InquiryCta />
    </div>
  );
}
