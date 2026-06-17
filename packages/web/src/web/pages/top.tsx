import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { PhotoGallery } from "../components/PhotoGallery";
import { InquiryCta } from "../components/InquiryCta";

/** Hero carousel with auto-play, swipe, and arrow navigation */
function HeroCarousel({ photos, fxRef }: { photos: { url: string; title: string }[]; fxRef?: React.Ref<HTMLDivElement> }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isHovering, setIsHovering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Pause autoplay on hover OR keyboard focus (WCAG 2.2.2: moving content pausable).
  const paused = isHovering || isFocused;
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const touchRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Respect the OS "reduce motion" setting — don't auto-advance for those users
  // (WCAG 2.2.2: moving content must be pausable; reduced-motion = keep it still).
  const prefersReducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, startTime: Date.now() };
  }, []);

  // A swipe that navigated must not also fire the click-to-advance handler
  // (touchend is followed by a synthetic click on most mobile browsers).
  const suppressClickRef = useRef(false);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;
    const dt = Date.now() - touchRef.current.startTime;
    touchRef.current = null;

    // Must be mostly horizontal swipe, and either > 50px or fast flick
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > 50 || (Math.abs(dx) > 20 && dt < 250))) {
      suppressClickRef.current = true;
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

  // Z1: クリック（タップ）でも次の写真へ。スワイプ直後の合成クリックは無視。
  const onClickAdvance = useCallback(() => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
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

  if (photos.length === 0) return <div className="w-full" style={{ height: '60vh' }}><div className="w-full h-full bg-[#eee] rounded-lg" /></div>;

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
              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClickAdvance(); } },
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
            <img
              key={i}
              src={`${p.url}?w=1800&q=88`}
              srcSet={`${p.url}?w=900&q=88 900w, ${p.url}?w=1400&q=88 1400w, ${p.url}?w=1800&q=88 1800w, ${p.url}?w=2400&q=88 2400w`}
              sizes="(min-width: 1200px) 1152px, 100vw"
              alt={p.title || "Photograph"}
              className={`hero-slide hero-slide-contain ${i === current ? `active slide-${direction}` : ""}`}
              style={{ zIndex: i === current ? 1 : 0 }}
              fetchPriority={i === 0 ? "high" : "low"}
              loading={i === 0 ? "eager" : "lazy"}
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
              draggable={false}
            />
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            className={`carousel-arrow carousel-arrow-right ${paused ? "visible" : ""}`}
            onClick={goNext}
            aria-label="次のスライド"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
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
function HeroSingle({ photo, children, titlePosition = "center", fxRef }: {
  photo: { url: string; title: string };
  children?: React.ReactNode;
  titlePosition?: string;
  fxRef?: React.Ref<HTMLDivElement>;
}) {
  const posClass = ["bottom-left", "bottom-right", "top-left", "top-right"].includes(titlePosition) ? `pos-${titlePosition}` : "";
  const overlayTop = titlePosition.startsWith("top-") ? "overlay-top" : "";
  return (
    <div className="hero-single">
      <div ref={fxRef} className="hero-fx-layer absolute inset-0">
        <img
          className="hero-single-img"
          src={`${photo.url}?w=1800&q=88`}
          srcSet={`${photo.url}?w=900&q=88 900w, ${photo.url}?w=1400&q=88 1400w, ${photo.url}?w=1800&q=88 1800w, ${photo.url}?w=2400&q=88 2400w`}
          sizes="100vw"
          alt={photo.title || "Photograph"}
          fetchPriority="high"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          draggable={false}
        />
        <div className={`hero-single-overlay ${overlayTop}`} />
      </div>
      <div className={`hero-single-caption ${posClass}`}>{children}</div>
    </div>
  );
}

export default function TopPage() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });
  const { data: photosData } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => (await api.photos.$get()).json(),
  });
  const { data: heroData, isLoading: heroLoading } = useQuery({
    queryKey: ["hero-photos"],
    queryFn: async () => (await api["hero-photos"].$get()).json(),
  });

  // Stable reference across renders so the `featured` useMemo doesn't recompute every render.
  const allPhotos = useMemo(() => photosData?.photos ?? [], [photosData]);
  // The API may return null entries for hero rows whose photo was deleted.
  const heroPhotosPicked = (heroData?.heroPhotos ?? []).filter(
    (p): p is NonNullable<typeof p> => p != null
  );
  // Don't fall back to gallery photos while hero-photos is still loading —
  // that would briefly flash unrelated photos in the hero before the real ones arrive.
  const heroPhotos = heroPhotosPicked.length > 0
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
  const topWorksMode = settings?.topWorksMode || "auto";
  const topWorksIds = settings?.topWorksIds || "";
  const worksPool = useMemo(() => {
    if (topWorksMode === "manual") {
      // Dedupe IDs: the admin enters topWorksIds as free-text CSV, and a repeated
      // ID would map to the same photo object twice — PhotoGallery keys tiles by
      // photo.id, so duplicates trigger a React key collision (a tile vanishes /
      // its reveal transition breaks). Set preserves first-seen order.
      const ids = [...new Set(topWorksIds.split(",").map((s: string) => parseInt(s.trim(), 10)).filter(Number.isFinite))];
      const byId = new Map(allPhotos.map((p) => [p.id, p]));
      const picked = ids.map((id: number) => byId.get(id)).filter((p): p is (typeof allPhotos)[number] => Boolean(p));
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
  const homeGalleryCount = Math.max(1, parseInt(settings?.homeGalleryCount ?? "12", 10) || 12);
  const WORKS_STEP = 9;
  const [extraCount, setExtraCount] = useState(0);
  const worksCount = homeGalleryCount + extraCount;
  const worksSentinelRef = useRef<HTMLDivElement>(null);
  const featured = useMemo(() => worksPool.slice(0, worksCount), [worksPool, worksCount]);
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
      { rootMargin: "900px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [worksCount, worksPool.length]);
  const siteNameJa = settings?.siteName ?? "江口秋";
  const siteNameEn = settings?.siteNameEn ?? "Aki Eguchi";
  const subtitle = settings?.heroSubtitle ?? "Photography";
  const fadeRef = useScrollFadeIn([featured, settings?.topWorksLayout]);
  const nameKata = settings?.profileNameKata ?? "";
  const heroMode = settings?.heroMode ?? "carousel";
  const isSingle = heroMode === "single" && heroPhotos.length > 0;

  // AA: hero presentation settings — defaults reproduce the pre-AA look exactly.
  const heroFullscreen = (settings?.heroDisplayMode || "normal") === "fullscreen";
  const heroTitlePosition = settings?.heroTitlePosition || "center";
  const heroScrollEffect = settings?.heroScrollEffect || "none";

  // AA3: scroll effect — rAF-throttled, transform/opacity only, applied to the
  // fx layer inside the hero's overflow-hidden box (no layout movement).
  const heroFxRef = useRef<HTMLDivElement>(null);
  const heroBoxRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = heroFxRef.current;
    if (!el) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.opacity = "";
    };
  }, [heroScrollEffect, isSingle, heroFullscreen]);

  return (
    <div>
      {isSingle ? (
        /* Hero: single large photo with name overlaid */
        <section ref={heroBoxRef} className={heroFullscreen ? "hero-fullscreen" : "pt-6 md:pt-10"}>
          <HeroSingle photo={heroPhotos[0]} titlePosition={heroTitlePosition} fxRef={heroFxRef}>
            <h1
              className="font-bold leading-tight break-words hero-text-reveal hero-text-reveal-1"
              style={{ fontSize: "var(--hero-name-size, 1.75rem)", fontWeight: "var(--hero-name-weight, 700)" as never, color: "#fff", letterSpacing: "var(--hero-name-tracking, 0.04em)", textShadow: "0 1px 18px rgba(0,0,0,0.45)" }}
            >
              {siteNameJa}
            </h1>
            {nameKata && (
              <p className="text-[10px] tracking-[0.18em] mt-1.5 hero-text-reveal hero-text-reveal-2" style={{ color: "rgba(255,255,255,0.70)", textShadow: "0 1px 12px rgba(0,0,0,0.4)" }}>
                {nameKata}
              </p>
            )}
            <p
              className="font-en mt-1 hero-text-reveal hero-text-reveal-2"
              style={{ fontSize: "var(--hero-name-en-size, 0.9375rem)", color: "rgba(255,255,255,0.82)", letterSpacing: "var(--hero-name-en-tracking, 0.08em)", textShadow: "0 1px 14px rgba(0,0,0,0.4)" }}
            >
              {siteNameEn}
            </p>
            <p
              className="font-en tracking-[0.10em] mt-1 hero-text-reveal hero-text-reveal-3"
              style={{ fontSize: "var(--hero-sub-size, 0.75rem)", color: "rgba(255,255,255,0.62)", textShadow: "0 1px 12px rgba(0,0,0,0.4)" }}
            >
              {subtitle}
            </p>
          </HeroSingle>
        </section>
      ) : (
        /* Hero: Carousel + Name block */
        <section ref={heroBoxRef} className={heroFullscreen ? "hero-fullscreen" : "max-w-6xl mx-auto px-4 md:px-10 pt-6 md:pt-10"}>
          <HeroCarousel photos={heroPhotos} fxRef={heroFxRef} />

          {/* Name block below carousel. AA2: in carousel mode the title sits
              under the photos, so the position setting maps to text alignment. */}
          <div className={`mt-12 md:mt-16 mb-10 ${heroFullscreen ? "px-6" : ""} ${
            heroTitlePosition.endsWith("-left") ? "text-left" : heroTitlePosition.endsWith("-right") ? "text-right" : "text-center"
          }`}>
            <h1
              className="font-bold leading-tight break-words hero-text-reveal hero-text-reveal-1"
              style={{ fontWeight: "var(--hero-name-weight, 700)" as never, fontSize: "var(--hero-name-size, 1.5rem)", color: "var(--hero-name-color, var(--foreground))", letterSpacing: "var(--hero-name-tracking, 0.04em)" }}
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
              style={{ fontSize: "var(--hero-name-en-size, 0.875rem)", color: "var(--hero-name-en-color, rgba(var(--foreground-rgb),0.40))", letterSpacing: "var(--hero-name-en-tracking, 0.08em)" }}
            >
              {siteNameEn}
            </p>
            <p
              className="font-en tracking-[0.10em] mt-1 hero-text-reveal hero-text-reveal-3"
              style={{ fontSize: "var(--hero-sub-size, 0.75rem)", color: "var(--hero-sub-color, rgba(var(--foreground-rgb),0.25))" }}
            >
              {subtitle}
            </p>
          </div>
        </section>
      )}

      {/* Photo Grid */}
      {featured.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(2rem*var(--spacing-hero-bottom,1))] md:pt-[calc(3rem*var(--spacing-hero-bottom,1))] pb-[calc(5rem*var(--spacing-section-gap,1))] md:pb-[calc(8rem*var(--spacing-section-gap,1))]" ref={fadeRef}>
          <div className="flex items-center justify-between mb-10 md:mb-14">
            <h2
              className="font-en uppercase section-reveal"
              style={{ fontSize: "var(--section-label-size, 0.75rem)", color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.30))`, letterSpacing: "var(--section-label-tracking, 0.12em)", lineHeight: "var(--section-leading, 1.2)" }}
            >
              {settings?.worksLabel ?? "Works"}
            </h2>
            <Link
              to="/gallery"
              className="font-en hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.55))] transition-colors duration-300 nav-link-luxury section-reveal"
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
          <PhotoGallery photos={featured} layoutType={settings?.topWorksLayout ?? "stagger"} variant="top" />

          {/* Infinite-feed sentinel — fires ~900px before it scrolls into view. */}
          {featured.length < worksPool.length && (
            <div ref={worksSentinelRef} aria-hidden="true" style={{ height: 1 }} />
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
