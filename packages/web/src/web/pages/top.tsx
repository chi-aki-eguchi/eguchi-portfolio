import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { PhotoGallery, type GalleryPhoto } from "../components/PhotoGallery";
import { Lightbox, type LightboxPhoto } from "../components/Lightbox";
import { InquiryCta } from "../components/InquiryCta";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { photoAltText } from "../lib/photo-alt";

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
        srcSet={mediumUrl ? undefined : srcSetFor(url, "hero", undefined, rotationDeg)}
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
}: {
  photos: HomeHeroPhoto[];
  fxRef?: React.Ref<HTMLDivElement>;
  photographerName?: string;
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

  if (photos.length === 0)
    return (
      <div className="w-full" style={{ height: "60vh" }}>
        <div className="w-full h-full bg-[#eee] rounded-lg" />
      </div>
    );

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
};

function toLightboxPhotos(photos: GalleryPhoto[]): LightboxPhoto[] {
  return photos.map((p) => ({
    url: p.url,
    title: p.title,
    camera: p.camera,
    lens: p.lens,
    filmType: p.filmType,
    mediumUrl: p.mediumUrl,
    rotationDeg: p.rotationDeg,
    description: p.description,
  }));
}

function fastPhotoSrc(
  photo: GalleryPhoto,
  fallbackW: number,
  fallbackQ: number,
  prefer: "thumb" | "medium" = "thumb",
): string {
  const generated =
    prefer === "medium"
      ? (photo.mediumUrl ?? photo.thumbUrl)
      : (photo.thumbUrl ?? photo.mediumUrl);
  return generated ?? srcFor(photo.url, fallbackW, fallbackQ, undefined, photo.rotationDeg);
}

function fastPhotoSrcSet(
  photo: GalleryPhoto,
  preset: "grid" | "hero" | "lightbox",
): string | undefined {
  return photo.thumbUrl || photo.mediumUrl
    ? undefined
    : srcSetFor(photo.url, preset, undefined, photo.rotationDeg);
}

/** Phase 2 — Home A: quiet hero photo + clean 3-column square grid. */
function HomeQuietGrid({
  heroPhotos,
  featured,
  worksPoolLen,
  worksSentinelRef,
  fadeRef,
  settings,
}: HomeLayoutProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const siteNameJa = settings?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const siteNameEn = settings?.siteNameEn ?? CLIENT_SITE_FALLBACKS.siteNameEn;
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const heroPhoto = heroPhotos[0];

  return (
    <div>
      {/* Hero: full-width photo with name overlay at bottom-left */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "min(280px, 50vh)" }}
      >
        {heroPhoto ? (
          <>
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
            <div className="absolute bottom-6 left-7">
              <h1
                className="font-serif leading-tight"
                style={{
                  fontSize: 32,
                  fontWeight: 300,
                  color: "#fff",
                  letterSpacing: "0.02em",
                  textShadow: "0 1px 8px rgba(0,0,0,0.3)",
                }}
              >
                {siteNameJa}
              </h1>
              <p
                className="font-en uppercase mt-0.5"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                {siteNameEn || "Photography"}
              </p>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-[#eee]" />
        )}
      </section>

      {/* Works: 3-column square grid */}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-5 pb-20"
          ref={fadeRef}
        >
          <div className="flex items-center justify-between mb-3.5">
            <h2
              className="font-en uppercase"
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                color: "#aaa",
              }}
            >
              {settings?.worksLabel ?? "Works"}
            </h2>
            <Link
              to="/gallery"
              className="font-en transition-colors duration-300 hover:text-[#888]"
              style={{ fontSize: 9, color: "#aaa" }}
            >
              {settings?.viewAllLabel ?? "View all →"}
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-[5px]">
            {featured.map((photo, idx) => (
              <button
                key={photo.id}
                className="aspect-square overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]"
                onClick={() => setLightboxIndex(idx)}
                aria-label={photoAltText(photo, { photographerName })}
              >
                <img
                  src={fastPhotoSrc(photo, 600, 85, "thumb")}
                  srcSet={fastPhotoSrcSet(photo, "grid")}
                  sizes="(min-width: 768px) 33vw, 50vw"
                  alt=""
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: objectPositionFromFocal(
                      photo.focalX,
                      photo.focalY,
                    ),
                  }}
                  decoding="async"
                  loading={idx < 9 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : undefined}
                  draggable={false}
                />
              </button>
            ))}
          </div>

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
              className="inline-block font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.55)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <InquiryCta />

      {lightboxIndex !== null && (
        <Lightbox
          photos={toLightboxPhotos(featured)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i !== null ? (i - 1 + featured.length) % featured.length : 0,
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? (i + 1) % featured.length : 0,
            )
          }
          photographerName={photographerName}
        />
      )}
    </div>
  );
}

/** Phase 2 — Home B: split hero + alternating large/small rhythm grid. */
function HomeEditorial({
  heroPhotos,
  featured,
  worksPoolLen,
  worksSentinelRef,
  fadeRef,
  settings,
}: HomeLayoutProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const siteNameJa = settings?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const siteNameEn = settings?.siteNameEn ?? CLIENT_SITE_FALLBACKS.siteNameEn;
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const statement = settings?.profileStatement ?? "";
  const heroPhoto = heroPhotos[0];

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const tile = (photo: GalleryPhoto, idx: number, className?: string) => (
    <button
      key={photo.id}
      className={`overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] ${className ?? ""}`}
      onClick={() => openLightbox(idx)}
      aria-label={photoAltText(photo, { photographerName })}
    >
      <img
        src={fastPhotoSrc(photo, 800, 88, "medium")}
        srcSet={fastPhotoSrcSet(photo, "grid")}
        sizes="(min-width: 768px) 40vw, 100vw"
        alt=""
        className="w-full h-full object-cover"
        style={{
          objectPosition: objectPositionFromFocal(photo.focalX, photo.focalY),
        }}
        decoding="async"
        loading={idx < 6 ? "eager" : "lazy"}
        draggable={false}
      />
    </button>
  );

  // Build alternating rows: odd rows = 1.6fr 1fr 1fr, even rows = 1fr 1fr 1.6fr
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < featured.length; i += 3) {
    const chunk = featured.slice(i, i + 3);
    const rowIdx = Math.floor(i / 3);
    const isOdd = rowIdx % 2 === 0;
    rows.push(
      <div
        key={i}
        className="grid gap-[5px]"
        style={{
          gridTemplateColumns:
            chunk.length >= 3
              ? isOdd
                ? "1.6fr 1fr 1fr"
                : "1fr 1fr 1.6fr"
              : `repeat(${chunk.length}, 1fr)`,
          height: "min(220px, 30vw)",
        }}
      >
        {chunk.map((photo, j) => tile(photo, i + j, "w-full h-full"))}
      </div>,
    );
  }

  return (
    <div>
      {/* Split hero: photo left, text right */}
      <section
        className="flex flex-col md:flex-row"
        style={{ minHeight: "min(340px, 50vh)" }}
      >
        <div
          className="md:flex-[0_0_55%] relative overflow-hidden bg-[#eee]"
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
          <h1
            className="font-serif leading-[1.1] mb-1.5"
            style={{
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 300,
              color: "#1a1a1a",
            }}
          >
            {siteNameJa}
          </h1>
          <p
            className="font-en mb-5"
            style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.06em" }}
          >
            {siteNameEn}
          </p>
          {statement && (
            <p
              className="font-ja"
              style={{
                fontSize: 10,
                color: "#888",
                lineHeight: 1.8,
                maxWidth: 240,
              }}
            >
              {statement}
            </p>
          )}
        </div>
      </section>

      {/* Works: alternating large/small rhythm grid */}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-5 pb-20"
          ref={fadeRef}
        >
          <div className="mb-3.5">
            <h2
              className="font-en uppercase"
              style={{ fontSize: 9, letterSpacing: "0.16em", color: "#aaa" }}
            >
              {settings?.worksLabel ?? "Works"}
            </h2>
          </div>

          <div className="flex flex-col gap-[5px]">{rows}</div>

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
              className="inline-block font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.55)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <InquiryCta />

      {lightboxIndex !== null && (
        <Lightbox
          photos={toLightboxPhotos(featured)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i !== null ? (i - 1 + featured.length) % featured.length : 0,
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? (i + 1) % featured.length : 0,
            )
          }
          photographerName={photographerName}
        />
      )}
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
}: HomeLayoutProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const siteNameJa = settings?.siteName ?? CLIENT_SITE_FALLBACKS.siteName;
  const siteNameEn = settings?.siteNameEn ?? CLIENT_SITE_FALLBACKS.siteNameEn;
  const photographerName = settings?.siteName || settings?.siteNameEn;
  const heroPhoto = heroPhotos[0];

  const displayMedium = (p: GalleryPhoto) => {
    if (p.filmType === "film") return "Film";
    if (p.filmType === "digital") return "Digital";
    return "";
  };
  const photoYear = (p: GalleryPhoto) => {
    if (!p.shotAt) return "";
    const y = new Date(p.shotAt).getFullYear();
    return Number.isFinite(y) ? String(y) : "";
  };

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
    <div>
      {/* Fullscreen hero with centered name */}
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100dvh" }}
      >
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
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#2a3a3a]" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        {/* Centered name */}
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div>
            <h1
              className="font-serif"
              style={{
                fontSize: "clamp(32px, 5vw, 40px)",
                fontWeight: 300,
                color: "#fff",
                letterSpacing: "0.06em",
                textShadow: "0 2px 16px rgba(0,0,0,0.4)",
              }}
            >
              {siteNameJa}
            </h1>
            <p
              className="font-en uppercase mt-1.5"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {siteNameEn || "Photography"}
            </p>
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

      {/* Large-format works with captions */}
      {featured.length > 0 && (
        <section
          className="max-w-4xl mx-auto px-6 md:px-12 pt-6 pb-20"
          ref={fadeRef}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-8 md:gap-y-12">
            {featured.map((photo, idx) => {
              const medium = displayMedium(photo);
              const year = photoYear(photo);
              const sub = [medium, year].filter(Boolean).join(" — ");
              return (
                <figure key={photo.id} className="m-0">
                  <button
                    className="w-full overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]"
                    onClick={() => setLightboxIndex(idx)}
                    aria-label={photoAltText(photo, { photographerName })}
                  >
                    <img
                      src={fastPhotoSrc(photo, 900, 88, "medium")}
                      srcSet={fastPhotoSrcSet(photo, "grid")}
                      sizes="(min-width: 768px) 45vw, 100vw"
                      alt=""
                      className="w-full"
                      decoding="async"
                      loading={idx < 4 ? "eager" : "lazy"}
                      draggable={false}
                    />
                  </button>
                  {(photo.title || sub) && (
                    <figcaption className="mt-2">
                      {photo.title && (
                        <p
                          className="font-en"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.06em",
                            color: "#aaa",
                          }}
                        >
                          {photo.title}
                          {sub ? ` — ${sub}` : ""}
                        </p>
                      )}
                      {!photo.title && sub && (
                        <p
                          className="font-en"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.06em",
                            color: "#aaa",
                          }}
                        >
                          {sub}
                        </p>
                      )}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>

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
              className="inline-block font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.55)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      <InquiryCta />

      {lightboxIndex !== null && (
        <Lightbox
          photos={toLightboxPhotos(featured)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i !== null ? (i - 1 + featured.length) % featured.length : 0,
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? (i + 1) % featured.length : 0,
            )
          }
          photographerName={photographerName}
        />
      )}
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
  const { data: photosData } = useQuery({
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
  const heroPhotos =
    heroPhotosPicked.length > 0
      ? heroPhotosPicked
      : heroLoading
        ? []
        : allPhotos.slice(0, 5);
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
  }, [heroScrollEffect, isSingle, heroFullscreen]);

  const homeLayoutProps: HomeLayoutProps = {
    heroPhotos,
    featured,
    worksPoolLen: worksPool.length,
    worksSentinelRef,
    fadeRef,
    settings,
  };

  if (heroMode === "quiet-grid") return <HomeQuietGrid {...homeLayoutProps} />;
  if (heroMode === "editorial") return <HomeEditorial {...homeLayoutProps} />;
  if (heroMode === "immersive") return <HomeImmersive {...homeLayoutProps} />;

  return (
    <div>
      {isSingle ? (
        /* Hero: single large photo with name overlaid */
        <section
          ref={heroBoxRef}
          className={heroFullscreen ? "hero-fullscreen" : "pt-6 md:pt-10"}
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
                className="text-[10px] tracking-[0.18em] mt-1.5 hero-text-reveal hero-text-reveal-2"
                style={{
                  color: "rgba(255,255,255,0.70)",
                  textShadow: "0 1px 12px rgba(0,0,0,0.4)",
                }}
              >
                {nameKata}
              </p>
            )}
            <p
              className="font-en mt-1 hero-text-reveal hero-text-reveal-2"
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
              className="font-en tracking-[0.10em] mt-1 hero-text-reveal hero-text-reveal-3"
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
          ref={heroBoxRef}
          className={
            heroFullscreen
              ? "hero-fullscreen"
              : "max-w-6xl mx-auto px-4 md:px-10 pt-6 md:pt-10"
          }
        >
          <HeroCarousel
            photos={heroPhotos}
            fxRef={heroFxRef}
            photographerName={photographerName}
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
              <p className="text-[10px] tracking-[0.18em] text-[rgba(var(--foreground-rgb),0.35)] mt-1.5 hero-text-reveal hero-text-reveal-2">
                {nameKata}
              </p>
            )}
            <p
              className="font-en mt-1 hero-text-reveal hero-text-reveal-2"
              style={{
                fontSize: "var(--hero-name-en-size, 0.875rem)",
                color:
                  "var(--hero-name-en-color, rgba(var(--foreground-rgb),0.40))",
                letterSpacing: "var(--hero-name-en-tracking, 0.08em)",
              }}
            >
              {siteNameEn}
            </p>
            <p
              className="font-en tracking-[0.10em] mt-1 hero-text-reveal hero-text-reveal-3"
              style={{
                fontSize: "var(--hero-sub-size, 0.75rem)",
                color:
                  "var(--hero-sub-color, rgba(var(--foreground-rgb),0.25))",
              }}
            >
              {subtitle}
            </p>
          </div>
        </section>
      )}

      {/* Photo Grid */}
      {featured.length > 0 && (
        <section
          className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(2rem*var(--spacing-hero-bottom,1))] md:pt-[calc(3rem*var(--spacing-hero-bottom,1))] pb-[calc(5rem*var(--spacing-section-gap,1))] md:pb-[calc(8rem*var(--spacing-section-gap,1))]"
          ref={fadeRef}
        >
          <div className="flex items-center justify-between mb-10 md:mb-14">
            <h2
              className="font-en uppercase section-reveal"
              style={{
                fontSize: "var(--section-label-size, 0.75rem)",
                color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.30))`,
                letterSpacing: "var(--section-label-tracking, 0.12em)",
                lineHeight: "var(--section-leading, 1.2)",
              }}
            >
              {settings?.worksLabel ?? "Works"}
            </h2>
            <Link
              to="/gallery"
              className="font-en hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.55))] transition-colors duration-300 nav-link-luxury section-reveal py-1.5"
              style={{
                transitionDelay: "0.05s",
                fontSize: "var(--section-label-size, 0.6875rem)",
                letterSpacing: "var(--section-label-tracking, 0.06em)",
                color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.30))`,
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
              className="inline-block font-ja border border-[rgba(var(--foreground-rgb),0.22)] px-12 py-4 text-[0.8rem] tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.55)] transition-all duration-500 hover:border-[var(--accent-color,rgba(var(--foreground-rgb),0.5))] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] hover:tracking-[0.16em]"
            >
              {settings?.viewAllCtaLabel || "すべての作品を見る"}
            </Link>
          </div>
        </section>
      )}

      {/* Closing 撮影依頼 CTA — the homepage's conversion moment (off by default) */}
      <InquiryCta />
    </div>
  );
}
