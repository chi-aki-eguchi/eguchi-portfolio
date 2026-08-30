import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { useLocation, useSearch } from "wouter";
import { api, jsonOrThrow } from "../lib/api";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { ContentStatus } from "../components/ContentStatus";
import { PhotoGallery } from "../components/PhotoGallery";
import { InquiryCta } from "../components/InquiryCta";
import { SeriesColophon } from "../components/SeriesColophon";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { routeKeyOf, scrollMemory } from "../lib/scroll-memory";

export default function GalleryPage() {
  // B-19 (owner decision 2026-08-05): every filter lives in the URL, with short
  // parameter names, and a default never writes a parameter at all — an
  // unfiltered gallery stays plain `/gallery`. Before this only the medium was
  // in the URL, so a chosen category could not be shared and vanished on
  // reload. `medium=` kept its name; it was already public.
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  // 覚える鍵は PageTransition と同じ形にする。ここだけ location（パスのみ）を
  // 使っていたため、絞り込み中は「どこまで読み込んでいたか」も復元できなかった。
  const routeKey = routeKeyOf(location, search);

  const activeMedium = useMemo(() => {
    const v = params.get("medium");
    return v === "film" || v === "digital" ? v : "all";
  }, [params]);
  const activeFilter = params.get("c") || "all";

  // Write the whole filter set at once so two of them can never disagree, and
  // drop anything sitting at its default rather than spelling it out.
  const applyFilters = (next: {
    c?: string;
    medium?: "all" | "film" | "digital";
  }) => {
    const merged = new URLSearchParams(params);
    const put = (key: string, value: string | null | undefined, dflt: string) => {
      if (value === undefined) return;
      if (!value || value === dflt) merged.delete(key);
      else merged.set(key, value);
    };
    put("c", next.c, "all");
    put("medium", next.medium, "all");
    const qs = merged.toString();
    setLocation(qs ? `${location}?${qs}` : location);
  };
  const setActiveFilter = (v: string) => applyFilters({ c: v });
  const setActiveMedium = (v: "all" | "film" | "digital") =>
    applyFilters({ medium: v });

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

  // シリーズの入口はナビの Series（`seriesNavEnabled` で on/off/auto）に一本化
  // した（2026-08-08 オーナー判断）。同じ SeriesGrid をここにも Photos/Series
  // タブとして出していたので、同じものへの入口が2つあった。`seriesData` は
  // ビューアのキャプションからシリーズ名・リンクを引くために残す。
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
    // シリーズに入れた写真をギャラリーから外す（2026-08-09 オーナー依頼）。
    // シリーズはシリーズのページで見せるものなので、ギャラリーには
    // どこにも属さない単発の写真だけを並べたい、という選択。既定は従来どおり
    // 「出す」。シリーズの写真もギャラリーに出るのが今までの見え方のため。
    if ((settings?.galleryExcludeSeries ?? "off") === "on") {
      list = list.filter((p) => p.seriesId == null);
    }
    return list;
  }, [allPhotos, activeFilter, activeMedium, settings?.galleryExcludeSeries]);

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
  // **最初に何枚並べるか。**少なく始めると、送っている途中で何度も足すことに
  // なり、そのたびに下にあるものが押し下げられる（実測 2026-08-30: ゆっくり
  // 読む人でズレ 0.751）。かといって全部（497枚）並べると、写真が出るまでが
  // 570ms 遅くなる。数画面ぶんを最初に置いて、あとは大きめに足す。
  const GALLERY_INITIAL = isMobile ? 36 : 120;
  // ひと束の枚数。1回の追加で稼げる高さが増えると、送る速さに追いつきやすい。
  const GALLERY_STEP = isMobile ? 24 : 60;
  // 戻ってきたときは、出ていった時点まで描き直してから位置を復元する（B-18）。
  // スクロール位置だけ覚えても、戻った先は最初のひと束しか描いていないので
  // 届かない（実測: 2400px を頼んで 692px までしか戻れない）。
  // `peekBatches` は戻ってきた場合だけ値を返す。前へ進んで入り直したときは
  // 0 なので、普段どおり先頭のひと束から始まる。
  const [extraCount, setExtraCount] = useState(() =>
    scrollMemory.peekBatches(routeKey),
  );
  useEffect(() => {
    scrollMemory.rememberBatches(routeKey, extraCount);
  }, [routeKey, extraCount]);
  const renderCount = GALLERY_INITIAL + extraCount;
  const rendered = useMemo(
    () => filtered.slice(0, renderCount),
    [filtered, renderCount],
  );
  const gallerySentinelRef = useRef<HTMLDivElement>(null);
  const gridBoxRef = useRef<HTMLDivElement>(null);
  const fadeRef = useScrollFadeIn([rendered, settings?.galleryLayout]);
  const loadMoreRetryRef = useRef<number | null>(null);
  const requestMorePhotos = useCallback(() => {
    const pendingImages = Array.from(
      fadeRef.current?.querySelectorAll<HTMLImageElement>(".photo-card img") ??
        [],
    ).filter((img) => !img.complete).length;
    // **送るのが速い人に追いつく。**待ちを厳しくしすぎると追加が繰り返し
    // 先送りされ、先に取っておいた場所（空）へ入り込んで真っ白な画面を見る
    // （実測 2026-08-30: 3600px の地点で画面内の写真が0枚だった）。
    // 同時に読み込む枚数を増やし、待ち直す間隔も詰める。
    const maxPending = isMobile ? 16 : 28;
    if (pendingImages > maxPending) {
      if (loadMoreRetryRef.current === null) {
        loadMoreRetryRef.current = window.setTimeout(() => {
          loadMoreRetryRef.current = null;
          requestMorePhotos();
        }, 220);
      }
      return;
    }
    setExtraCount((c) => {
      const current = GALLERY_INITIAL + c;
      return current >= filtered.length ? c : c + GALLERY_STEP;
    });
  }, [GALLERY_INITIAL, GALLERY_STEP, fadeRef, filtered.length, isMobile]);

  // 絞り込みを変えたら追加読み込みは最初からやり直す。ただし**マウント時は
  // 走らせない** — 戻ってきたときに復元した読み込み済みの束を、その場で0へ
  // 潰してしまい B-18 の修正が効かなくなる。
  const prevFilterKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeFilter}/${activeMedium}`;
    if (prevFilterKey.current === null) {
      prevFilterKey.current = key;
      return;
    }
    if (prevFilterKey.current === key) return;
    prevFilterKey.current = key;
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

  // Switching the filter while scrolled deep can shrink the page and strand the
  // viewer at the footer of a now-short grid. Scroll back to the top of the
  // section so the new selection starts in view.
  const prevViewKey = useRef<string | null>(null);
  useEffect(() => {
    const key = activeFilter;
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
  }, [activeFilter, fadeRef]);

  return (
    <section
      className="max-w-5xl mx-auto site-page site-page-top pb-12 md:pb-32"
      ref={fadeRef}
    >
      <PageTitle className="mb-10 md:mb-24" revealClass="section-reveal">
        {settings?.galleryLabel ?? "Gallery"}
      </PageTitle>

      {/* Filter — カテゴリ */}
      {categories.length > 0 && (
        <div
          /* 下の段（Film / Digital）とは別の絞り込みなのに、間が 16px しか
             なく、しかもどちらの先頭も「All」で始まる。1つの並びが折り返して
             いるようにしか見えなかったので、2つに読める間隔を空ける。 */
          className="gallery-filter-row flex md:flex-wrap md:justify-center gap-x-6 gap-y-2 mb-7 md:mb-8 section-reveal overflow-x-auto md:overflow-x-visible scrollbar-hide"
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
                  : "text-[color:var(--text-quiet)] font-normal border-transparent hover:text-[color:var(--text-quiet)]"
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
          className="gallery-filter-row gallery-filter-row--sub flex md:flex-wrap md:justify-center gap-x-5 gap-y-2 mb-14 md:mb-16 section-reveal overflow-x-auto md:overflow-x-visible scrollbar-hide"
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
              className={`tap-target font-en text-[0.6875rem] tracking-[0.06em] pt-1 pb-1 transition-all duration-300 nav-link-luxury border-b ${
                activeMedium === val
                  ? "text-[var(--foreground)] font-medium border-[var(--foreground)]"
                  : "text-[color:var(--text-quiet)] font-normal border-transparent hover:text-[color:var(--text-quiet)]"
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
            {/* 1画面ぶんの高さを取れる枚数。少ないと、本物が入った瞬間に
                下の帯（撮影のご依頼）とフッターが押し下げられる。 */}
            {Array.from({ length: 12 }, (_, i) => (
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
            {/* 見出し（GALLERY）は英語で揃えてあるが、読み手へ向けた「文」は
                日本語にする。/gallery に英語ルートは無いので出し分けは要らない。 */}
            <p className="font-ja text-xs tracking-[0.08em] text-[color:var(--text-quiet)]">
              まだ写真がありません
            </p>
          </div>
        )
      ) : (
        <>
          <div ref={gridBoxRef}>
          <PhotoGallery
            photos={rendered}
            layoutType={settings?.galleryLayout}
            onRequestMore={
              rendered.length < filtered.length
                ? requestMorePhotos
                : undefined
            }
            totalCount={filtered.length}
            seriesNameById={seriesNameById}
            seriesSlugById={seriesSlugById}
            categoryLabelBySlug={categoryLabelBySlug}
          />
          </div>
          {rendered.length < filtered.length && (
            <div
              ref={gallerySentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />
          )}
          {/* **終わりの帯は、本当に終わったときだけ出す。**
              まだ写真が続くあいだに出しておくと、写真が足されるたびに下へ
              飛ぶ（実測 2026-08-30: ゆっくり読む人でズレ 0.75）。読んでいる
              最中に動くのがいちばん落ち着かない。ここは一覧の終端なので、
              終端に着いたときに現れるのが本来の姿でもある。 */}
          {rendered.length >= filtered.length && (
            <SeriesColophon photos={filtered} />
          )}
        </>
      )}

      {rendered.length >= filtered.length && <InquiryCta />}
    </section>
  );
}
