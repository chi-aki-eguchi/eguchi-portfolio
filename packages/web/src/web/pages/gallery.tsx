import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { api, jsonOrThrow } from "../lib/api";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { ContentStatus } from "../components/ContentStatus";
import { PhotoGallery } from "../components/PhotoGallery";
import { SeriesGrid } from "../components/SeriesGrid";
import { InquiryCta } from "../components/InquiryCta";
import { sortPhotosBySetting } from "../lib/photo-sort";

export default function GalleryPage() {
  // B-19 (owner decision 2026-08-05): every filter lives in the URL, with short
  // parameter names, and a default never writes a parameter at all — an
  // unfiltered gallery stays plain `/gallery`. Before this only the medium was
  // in the URL, so a chosen category could not be shared and vanished on
  // reload. `medium=` kept its name; it was already public.
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const activeMedium = useMemo(() => {
    const v = params.get("medium");
    return v === "film" || v === "digital" ? v : "all";
  }, [params]);
  const activeFilter = params.get("c") || "all";
  const pinnedView = useMemo(() => {
    const v = params.get("v");
    return v === "photos" || v === "series" ? v : null;
  }, [params]);

  // Write the whole filter set at once so two of them can never disagree, and
  // drop anything sitting at its default rather than spelling it out.
  const applyFilters = (next: {
    c?: string;
    medium?: "all" | "film" | "digital";
    v?: "photos" | "series" | null;
  }) => {
    const merged = new URLSearchParams(params);
    const put = (key: string, value: string | null | undefined, dflt: string) => {
      if (value === undefined) return;
      if (!value || value === dflt) merged.delete(key);
      else merged.set(key, value);
    };
    put("c", next.c, "all");
    put("medium", next.medium, "all");
    put("v", next.v ?? undefined, "");
    const qs = merged.toString();
    setLocation(qs ? `${location}?${qs}` : location);
  };
  const setActiveFilter = (v: string) => applyFilters({ c: v });
  const setActiveMedium = (v: "all" | "film" | "digital") =>
    applyFilters({ medium: v });
  const setPinnedView = (v: "photos" | "series" | null) => applyFilters({ v });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const {
    data: photosData,
    isLoading: photosLoading,
    isError: photosError,
    error: photosErrorObj,
    refetch: refetchPhotos,
  } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const { data: seriesData } = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
    // Categories rarely change; keep them fresh longer so the prefetched data is
    // used as-is on navigation (no background refetch / flicker).
    staleTime: 5 * 60_000,
  });

  const hasSeries = (seriesData?.series.length ?? 0) > 0;
  const defaultView =
    settings?.worksDefaultView === "series" ? "series" : "photos";
  const view = hasSeries ? (pinnedView ?? defaultView) : "photos";

  // Memoise so references are stable across renders — otherwise dependent
  // useMemo/useEffect (and useScrollFadeIn) re-run every render.
  const allPhotos = useMemo(
    () =>
      sortPhotosBySetting(photosData?.photos ?? [], settings?.gallerySortOrder),
    [photosData, settings?.gallerySortOrder],
  );
  const categories = useMemo(() => catsData?.categories ?? [], [catsData]);
  const seriesNameById = useMemo(
    () =>
      Object.fromEntries(
        (seriesData?.series ?? []).map((s) => [s.id, s.title]),
      ),
    [seriesData],
  );
  const seriesSlugById = useMemo(
    () =>
      Object.fromEntries((seriesData?.series ?? []).map((s) => [s.id, s.slug])),
    [seriesData],
  );
  const categoryLabelBySlug = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.label])),
    [categories],
  );
  const filtered = useMemo(() => {
    let list =
      activeFilter === "all"
        ? allPhotos
        : allPhotos.filter((p) => p.category === activeFilter);
    if (activeMedium !== "all") {
      const target = activeMedium === "film" ? "フィルム" : "デジタル";
      list = list.filter(
        (p) => (p as Record<string, unknown>).filmType === target,
      );
    }
    return list;
  }, [allPhotos, activeFilter, activeMedium]);

  // If the active category no longer exists (e.g. it was deleted/renamed), fall
  // back to "All" instead of stranding the user on an empty, unhighlighted filter.
  useEffect(() => {
    if (
      activeFilter !== "all" &&
      categories.length > 0 &&
      !categories.some((c) => c.slug === activeFilter)
    ) {
      // Drop the parameter rather than writing c=all — a default never appears
      // in the URL (B-19).
      applyFilters({ c: "all" });
    }
    // applyFilters closes over `location`/`params`, which change on every URL
    // edit; depending on it would re-run this guard on each navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, categories]);

  const filterItems = [
    { slug: "all", label: settings?.filterAllLabel ?? "All" },
    ...categories.map((c) => ({ slug: c.slug, label: c.label })),
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const GALLERY_INITIAL = isMobile ? 12 : 24;
  const GALLERY_STEP = 12;
  const [extraCount, setExtraCount] = useState(0);
  const renderCount = GALLERY_INITIAL + extraCount;
  const rendered = useMemo(
    () => filtered.slice(0, renderCount),
    [filtered, renderCount],
  );
  const gallerySentinelRef = useRef<HTMLDivElement>(null);
  const fadeRef = useScrollFadeIn([rendered, view, settings?.galleryLayout]);
  const loadMoreRetryRef = useRef<number | null>(null);
  const requestMorePhotos = useCallback(() => {
    const pendingImages = Array.from(
      fadeRef.current?.querySelectorAll<HTMLImageElement>(".photo-card img") ??
        [],
    ).filter((img) => !img.complete).length;
    const maxPending = isMobile ? 8 : 12;
    if (pendingImages > maxPending) {
      if (loadMoreRetryRef.current === null) {
        loadMoreRetryRef.current = window.setTimeout(() => {
          loadMoreRetryRef.current = null;
          requestMorePhotos();
        }, 450);
      }
      return;
    }
    setExtraCount((c) => {
      const current = GALLERY_INITIAL + c;
      return current >= filtered.length ? c : c + GALLERY_STEP;
    });
  }, [GALLERY_INITIAL, fadeRef, filtered.length, isMobile]);

  useEffect(() => {
    setExtraCount(0);
    if (loadMoreRetryRef.current !== null) {
      window.clearTimeout(loadMoreRetryRef.current);
      loadMoreRetryRef.current = null;
    }
  }, [activeFilter, activeMedium]);
  useEffect(() => {
    if (renderCount >= filtered.length) return;
    const el = gallerySentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          requestMorePhotos();
        }
      },
      { rootMargin: "450px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [renderCount, filtered.length, requestMorePhotos]);

  // Switching the filter (or Photos/Series view) while scrolled deep can shrink
  // the page and strand the viewer at the footer of a now-short grid. Scroll
  // back to the top of the section so the new selection starts in view.
  const prevViewKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeFilter}/${view}`;
    if (prevViewKey.current === null) {
      prevViewKey.current = key;
      return;
    } // initial mount — don't scroll
    if (prevViewKey.current === key) return;
    prevViewKey.current = key;
    const el = fadeRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top + 40) {
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: Math.max(0, top - 70),
        behavior: reduce ? "auto" : "smooth",
      }); // 70px ≈ fixed header + breathing room
    }
  }, [activeFilter, view, fadeRef]);

  return (
    <section
      className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(8rem*var(--spacing-page-top,1))] pb-12 md:pb-32"
      ref={fadeRef}
    >
      <h1
        className="font-en uppercase text-center mb-10 md:mb-24 section-reveal"
        style={{
          fontSize: "var(--section-label-size, 0.75rem)",
          color: "var(--section-label-color)",
          letterSpacing: "var(--section-label-tracking, 0.10em)",
          lineHeight: "var(--section-leading, 1.2)",
        }}
      >
        {settings?.galleryLabel ?? "Gallery"}
      </h1>

      {/* P1: Photos / Series view toggle — only when there are series to show */}
      {hasSeries && (
        <div className="flex justify-center gap-x-8 mb-12 md:mb-14 section-reveal">
          {(
            [
              ["photos", "Photos"],
              ["series", "Series"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPinnedView(val)}
              aria-pressed={view === val}
              className={`tap-target font-en text-xs tracking-[0.08em] pt-1.5 pb-1.5 transition-all duration-300 nav-link-luxury border-b-[1.5px] ${
                view === val
                  ? "text-[var(--foreground)] font-medium border-[var(--foreground)]"
                  : "text-[color:var(--text-quiet)] border-transparent hover:text-[color:var(--text-quiet)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "series" ? (
        <SeriesGrid />
      ) : (
        <>
          {/* Filter — カテゴリ */}
          {categories.length > 0 && (
            <div
              className="flex md:flex-wrap md:justify-center gap-x-6 gap-y-2 mb-6 section-reveal overflow-x-auto md:overflow-x-visible -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 scrollbar-hide"
              style={{
                transitionDelay: "0.1s",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {filterItems.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setActiveFilter(cat.slug)}
                  aria-pressed={activeFilter === cat.slug}
                  className={`tap-target font-en text-xs tracking-[0.04em] pt-1.5 pb-1.5 transition-all duration-300 nav-link-luxury border-b-[1.5px] whitespace-nowrap shrink-0 ${
                    activeFilter === cat.slug
                      ? "text-[var(--foreground)] font-medium border-[var(--foreground)]"
                      : "text-[color:var(--text-quiet)] border-transparent hover:text-[color:var(--text-quiet)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 機能8: フィルム/デジタルフィルター（filmTypeが存在する写真がある場合のみ表示） */}
          {allPhotos.some((p) => (p as Record<string, unknown>).filmType) && (
            <div
              className="flex md:flex-wrap md:justify-center gap-x-6 gap-y-2 mb-14 md:mb-16 section-reveal overflow-x-auto md:overflow-x-visible -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 scrollbar-hide"
              style={{
                transitionDelay: "0.15s",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {(
                [
                  ["all", settings?.filterAllLabel ?? "All"],
                  ["film", "Film"],
                  ["digital", "Digital"],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setActiveMedium(val)}
                  aria-pressed={activeMedium === val}
                  className={`tap-target font-en text-xs tracking-[0.04em] pt-1.5 pb-1.5 transition-all duration-300 nav-link-luxury border-b-[1.5px] ${
                    activeMedium === val
                      ? "text-[var(--foreground)] font-medium border-[var(--foreground)]"
                      : "text-[color:var(--text-quiet)] border-transparent hover:text-[color:var(--text-quiet)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            // Don't flash "No photos" while the first fetch is still in flight.
            photosLoading ? (
              <div className="gallery-skeleton" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} />
                ))}
              </div>
            ) : photosError ? (
              // A failed fetch is not an empty gallery — say so, and offer a
              // reload instead of quietly showing "No photos" (fail-quiet trap).
              // Naming the cause only after a failed reload is the shared rule;
              // see ContentStatus.
              <ContentStatus
                state="error"
                error={photosErrorObj}
                onRetry={() => void refetchPhotos()}
                className="py-24"
              />
            ) : (
              <div className="py-24 text-center">
                <p className="font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">
                  No photos
                </p>
              </div>
            )
          ) : (
            <>
              <PhotoGallery
                photos={rendered}
                layoutType={settings?.galleryLayout}
                onRequestMore={
                  rendered.length < filtered.length
                    ? requestMorePhotos
                    : undefined
                }
                seriesNameById={seriesNameById}
                seriesSlugById={seriesSlugById}
                categoryLabelBySlug={categoryLabelBySlug}
              />
              {rendered.length < filtered.length && (
                <div
                  ref={gallerySentinelRef}
                  aria-hidden="true"
                  style={{ height: 1 }}
                />
              )}
            </>
          )}
        </>
      )}

      <InquiryCta />
    </section>
  );
}
