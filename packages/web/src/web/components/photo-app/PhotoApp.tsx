import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../../lib/api";
import { usePageLanguage } from "../../hooks/usePageLanguage";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useServiceVisibility } from "../provider";
import { shouldShowShelf } from "../../lib/shelf-nav";
import { sortPhotosBySetting } from "../../lib/photo-sort";
import { srcFor } from "../../lib/picture";
import { hasPublicEnglishContent } from "../../../shared/public-english";
import { isServiceOwnerSite } from "../../../shared/service-visibility";
import { signalAnalyticsPageReady } from "../../lib/analytics";
import { ContentStatus } from "../ContentStatus";
import type { GalleryPhoto } from "../PhotoGallery";
import { PhotoAppGallery, type PhotoAppGalleryHandle } from "./PhotoAppGallery";
import { PhotoAppViewer } from "./PhotoAppViewer";
import { PhotoAppIcon as Icon } from "./PhotoAppIcons";
import { usePhotoAppGlass } from "./photo-app-glass";
import "./photo-app.css";

const ProfilePage = lazy(() => import("../../pages/profile"));
const ContactPage = lazy(() => import("../../pages/contact"));
type Settings = Record<string, string>;
type Series = {
  id: number;
  title: string;
  slug: string;
  subtitle?: string;
  statement?: string;
  coverUrl?: string | null;
  coverRotationDeg?: number | null;
  photoCount?: number;
  kind?: string | null;
  themeConfig?: string | null;
};
type SeriesDetail = { series: Series; photos: GalleryPhoto[] };
const EMPTY: GalleryPhoto[] = [];
const routeMemory = new Map<string, number>();

function withoutPhoto(search: string) {
  const params = new URLSearchParams(search);
  params.delete("photo");
  return params;
}
function readColumns() {
  try {
    const stored = Number(sessionStorage.getItem("photo-app-columns"));
    if (stored >= 2 && stored <= 8) return stored;
  } catch {}
  return innerWidth <= 700 ? 3 : 5;
}

export default function PhotoApp({ settings }: { settings: Settings }) {
  const [path, navigate] = useLocation(),
    search = useSearch();
  const root = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLElement>(null),
    gallery = useRef<PhotoAppGalleryHandle>(null);
  const opener = useRef<DOMRect | null>(null),
    lastViewed = useRef<number | null>(null);
  const [columns, setColumns] = useState(readColumns),
    [mobile, setMobile] = useState(() => innerWidth <= 700);
  const [searchOpen, setSearchOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null),
    filtersDialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const params = useMemo(() => withoutPhoto(search), [search]);
  const query = params.get("q") || "",
    sort = params.get("sort") || "curated",
    category = params.get("c") || "all",
    medium = params.get("medium") || "all";
  const photoId = Number(new URLSearchParams(search).get("photo")) || null;
  const routeKey = path + (params.size ? "?" + params : "");
  const previousRoute = useRef(routeKey),
    previousPath = useRef(path);
  const selected = path === "/",
    isGallery = path === "/gallery";
  const detailPath = /^\/(series|work)\/([^/]+)$/.exec(path);
  const shelf = path.startsWith("/work") ? "work" : "series";
  const isShelf = path === "/series" || path === "/work";
  const isAbout = /\/(about|profile)$/.test(path),
    isContact = path.endsWith("/contact"),
    english = path.startsWith("/en/");
  const isDetail = Boolean(detailPath);
  const photoPage = selected || isGallery || isDetail;
  const { showService, showServiceInNav } = useServiceVisibility();
  const count = Math.min(
    60,
    Math.max(1, Number(settings.homeGalleryCount) || 18),
  );
  const random = settings.topWorksMode === "random";
  const limitedRandom = random && settings.heroRandom !== "any";

  const seriesQuery = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
    staleTime: 60_000,
  });
  const worksQuery = useQuery({
    queryKey: ["works"],
    queryFn: async () =>
      jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
    enabled: settings.workNavEnabled !== "off" || shelf === "work",
    staleTime: 60_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
    enabled: photoPage,
    staleTime: 300_000,
  });
  const photoQuery = useQuery({
    queryKey:
      selected && limitedRandom
        ? ["photos", "photo-app-random", count]
        : ["photos"],
    queryFn: async () =>
      jsonOrThrow(
        await api.photos.$get(
          selected && limitedRandom
            ? { query: { limit: String(count), order: "random" } }
            : {},
        ),
      ),
    enabled: selected || isGallery,
    staleTime: 300_000,
  });
  const heroQuery = useQuery({
    queryKey: ["hero-photos"],
    queryFn: async () => jsonOrThrow(await api["hero-photos"].$get()),
    enabled: selected,
    staleTime: 60_000,
  });
  const detailQuery = useQuery({
    queryKey: ["series", detailPath?.[2] || ""],
    queryFn: async (): Promise<SeriesDetail | null> => {
      const response = await fetch(
        `/api/series/${encodeURIComponent(decodeURIComponent(detailPath![2]))}`,
      );
      if (response.status === 404) return null;
      return jsonOrThrow(response);
    },
    enabled: Boolean(detailPath),
  });
  const series = useMemo(
    () => (seriesQuery.data?.series ?? []) as Series[],
    [seriesQuery.data],
  );
  const works = useMemo(
    () => (worksQuery.data?.series ?? []) as Series[],
    [worksQuery.data],
  );
  const fetchedDetail = detailPath ? detailQuery.data : null;
  const detail =
    fetchedDetail &&
    (fetchedDetail.series.kind === "work" ? "work" : "series") !== shelf
      ? null
      : fetchedDetail;
  const seriesTheme = useMemo(() => {
    try {
      return JSON.parse(detail?.series.themeConfig || "{}") as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  }, [detail?.series.themeConfig]);
  const allPhotos = (photoQuery.data?.photos ?? EMPTY) as GalleryPhoto[];
  const photos = useMemo(() => {
    let list: GalleryPhoto[];
    if (isDetail) {
      const order =
        seriesTheme.photoOrder &&
        !["inherit", "manual_inherit"].includes(seriesTheme.photoOrder)
          ? seriesTheme.photoOrder
          : settings.seriesSortOrder;
      list = sortPhotosBySetting(detail?.photos ?? EMPTY, order);
    } else if (selected) {
      const ordered = random
        ? limitedRandom
          ? allPhotos
          : sortPhotosBySetting(allPhotos, "random")
        : sortPhotosBySetting(allPhotos, settings.gallerySortOrder);
      const ids = [
        ...new Set(
          (settings.topWorksIds || "").split(",").map(Number).filter(Boolean),
        ),
      ];
      const byId = new Map(ordered.map((photo) => [photo.id, photo]));
      const manual =
        settings.topWorksMode === "manual"
          ? ids
              .map((id) => byId.get(id))
              .filter((photo): photo is GalleryPhoto => Boolean(photo))
          : [];
      const picked = manual.length ? manual : ordered.slice(0, count);
      // Keep the owner's HERO choices at the front of the compact overview.
      // Dedicated choices are read as references; neither order nor data is rewritten.
      const heroPicks = (heroQuery.data?.heroPhotos ?? []).filter(
        Boolean,
      ) as GalleryPhoto[];
      const heroes =
        settings.heroRandom === "any"
          ? sortPhotosBySetting(allPhotos, "random").slice(
              0,
              Math.max(1, heroPicks.length || 5),
            )
          : settings.heroRandom === "shuffle"
            ? sortPhotosBySetting(heroPicks, "random")
            : heroPicks;
      list = [
        ...new Map(
          [...heroes, ...picked].map((photo) => [photo.id, photo]),
        ).values(),
      ];
    } else list = sortPhotosBySetting(allPhotos, settings.gallerySortOrder);
    if (isGallery && settings.galleryExcludeSeries === "on")
      list = list.filter((photo) => photo.seriesId == null);
    if (category !== "all")
      list = list.filter((photo) => photo.category === category);
    if (medium !== "all")
      list = list.filter(
        (photo) =>
          photo.filmType === (medium === "film" ? "フィルム" : "デジタル"),
      );
    if (query.trim()) {
      const needle = query.trim().toLocaleLowerCase();
      list = list.filter((photo) =>
        [
          photo.title,
          photo.description,
          photo.filename,
          photo.shotAt,
          photo.camera,
          photo.filmType,
          photo.id,
        ].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(needle),
        ),
      );
    }
    if (sort === "newest" || sort === "oldest")
      list = [...list].sort((a, b) =>
        !a.shotAt
          ? b.shotAt
            ? 1
            : 0
          : !b.shotAt
            ? -1
            : a.shotAt.localeCompare(b.shotAt) * (sort === "newest" ? -1 : 1),
      );
    return list;
  }, [
    allPhotos,
    detail,
    isDetail,
    seriesTheme,
    selected,
    isGallery,
    random,
    limitedRandom,
    settings.gallerySortOrder,
    settings.seriesSortOrder,
    settings.topWorksIds,
    settings.topWorksMode,
    settings.heroRandom,
    settings.galleryExcludeSeries,
    count,
    heroQuery.data,
    category,
    medium,
    query,
    sort,
  ]);
  const showSeries = shouldShowShelf(settings.seriesNavEnabled, series.length),
    showWork = shouldShowShelf(settings.workNavEnabled, works.length);
  const links = [
    {
      href: "/",
      label: english ? "Photos" : "写真",
      icon: "photos" as const,
      current: selected || isGallery,
    },
    ...(showSeries
      ? [
          {
            href: "/series",
            label: english ? "Series" : "シリーズ",
            icon: "series" as const,
            current: path.startsWith("/series"),
          },
        ]
      : []),
    ...(showWork
      ? [
          {
            href: "/work",
            label: settings.navLabelWork || "Work",
            icon: "series" as const,
            current: path.startsWith("/work"),
          },
        ]
      : []),
    {
      href: english ? "/en/about" : "/about",
      label: english ? "About" : "プロフィール",
      icon: "person" as const,
      current: isAbout,
    },
  ];
  const title =
    detail?.series.title ||
    (isShelf
      ? shelf === "work"
        ? settings.navLabelWork || "Work"
        : "シリーズ"
      : isAbout
        ? english
          ? "About"
          : "プロフィール"
        : isContact
          ? english
            ? "Contact"
            : "撮影のご相談"
          : "写真");
  usePageTitle(selected ? undefined : title);
  usePageLanguage(english ? "en" : "ja");
  usePhotoAppGlass(root);
  useEffect(() => {
    const mq = matchMedia("(max-width: 700px)");
    const change = () => setMobile(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  const effectiveColumns = Math.min(columns, mobile ? 5 : 8);
  const changeColumns = (next: number) => {
    const value = Math.max(2, Math.min(mobile ? 5 : 8, next));
    setColumns(value);
    try {
      sessionStorage.setItem("photo-app-columns", String(value));
    } catch {}
  };
  const putParams = (changes: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === "all" || value === "curated") next.delete(key);
      else next.set(key, value);
    }
    navigate(path + (next.size ? "?" + next : ""), { replace });
  };
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (previousPath.current !== path) {
      setFiltersOpen(false);
      setSearchOpen(false);
      element.focus({ preventScroll: true });
      previousPath.current = path;
    }
    previousRoute.current = routeKey;
    const saved = routeMemory.get(routeKey) || 0;
    const frame = requestAnimationFrame(() => {
      element.scrollTop = saved;
      element.dispatchEvent(new Event("scroll"));
    });
    return () => cancelAnimationFrame(frame);
  }, [path, routeKey, photoQuery.data, detailQuery.data]);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const surface = root.current;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const remember = () => {
      routeMemory.set(previousRoute.current, element.scrollTop);
      // Large desktop backdrops are expensive while the canvas is moving.
      // Only enter/leave a CSS state; virtual rows own the coalesced scroll rendering.
      surface?.classList.add("pa-scroll-in-motion");
      clearTimeout(settle);
      settle = setTimeout(
        () => surface?.classList.remove("pa-scroll-in-motion"),
        180,
      );
    };
    element.addEventListener("scroll", remember, { passive: true });
    return () => {
      element.removeEventListener("scroll", remember);
      clearTimeout(settle);
      surface?.classList.remove("pa-scroll-in-motion");
    };
  }, []);
  // Only a successfully resolved public detail can confirm a dynamic analytics page.
  useEffect(() => {
    if (detail?.series) signalAnalyticsPageReady(path);
  }, [path, detail]);
  const seriesLinks = useMemo(
    () =>
      Object.fromEntries(
        [...series, ...works].map((item) => [
          item.id,
          {
            title: item.title,
            href: `/${item.kind === "work" ? "work" : "series"}/${item.slug}`,
          },
        ]),
      ),
    [series, works],
  );
  const index = photoId
    ? photos.findIndex((photo) => photo.id === photoId)
    : -1;
  const openPhoto = (photo: GalleryPhoto, button: HTMLButtonElement) => {
    opener.current =
      button.querySelector("img")?.getBoundingClientRect() ||
      button.getBoundingClientRect();
    lastViewed.current = photo.id;
    const next = new URLSearchParams(params);
    next.set("photo", String(photo.id));
    navigate(path + "?" + next, { state: { photoAppOpened: true } });
  };
  const closePhoto = useCallback(() => {
    if (history.state?.photoAppOpened) history.back();
    else {
      const next = withoutPhoto(window.location.search);
      navigate(path + (next.size ? "?" + next : ""), { replace: true });
    }
  }, [path, navigate]);
  const movePhoto = (nextIndex: number) => {
    const photo = photos[nextIndex];
    if (!photo) return;
    lastViewed.current = photo.id;
    const next = new URLSearchParams(params);
    next.set("photo", String(photo.id));
    navigate(path + "?" + next, { replace: true, state: history.state });
  };
  useEffect(() => {
    if (index >= 0) {
      lastViewed.current = photos[index].id;
      return;
    }
    if (lastViewed.current != null) {
      gallery.current?.reveal(lastViewed.current);
      lastViewed.current = null;
    }
  }, [index, photos]);
  useEffect(() => {
    const element = filtersDialog.current;
    if (!element) return;
    if (filtersOpen) element.showModal();
    else if (element.open) {
      element.close();
      filtersButton.current?.focus({ preventScroll: true });
    }
  }, [filtersOpen]);
  const loading = detailPath
    ? detailQuery.isPending
    : photoQuery.isPending || (selected && heroQuery.isPending);
  const failed = detailPath
    ? detailQuery.isError
    : photoQuery.isError || (selected && heroQuery.isError);
  const retryPhotos = () => {
    void photoQuery.refetch();
    if (selected) void heroQuery.refetch();
    if (detailPath) void detailQuery.refetch();
  };
  const activeShelf = shelf === "work" ? works : series,
    shelfQuery = shelf === "work" ? worksQuery : seriesQuery;
  const navStyle = {
    "--pa-nav-count": links.length,
    "--pa-nav-index": Math.max(
      0,
      links.findIndex((link) => link.current),
    ),
  } as CSSProperties;
  const siteName = settings.siteName || settings.siteNameEn || "Photographs";

  return (
    <div
      ref={root}
      className={`photo-app${searchOpen && photoPage ? " pa-search-open" : ""}${photoPage ? "" : " pa-reading"}`}
      data-public-experience="photo-app"
    >
      <a
        className="pa-skip"
        href="#photo-app-content"
        onClick={(event) => {
          event.preventDefault();
          scroll.current?.focus();
        }}
      >
        写真へ移動
      </a>
      <aside className="pa-sidebar pa-glass">
        <Link to="/" className="pa-identity">
          {siteName}
          <small>{settings.siteNameEn}</small>
        </Link>
        <span className="pa-section-label">作品</span>
        <nav
          className="pa-primary-nav"
          style={navStyle}
          aria-label="主なページ"
        >
          <span
            className="pa-nav-indicator"
            aria-hidden="true"
            hidden={!links.some((link) => link.current)}
          />
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              aria-current={link.current ? "page" : undefined}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
        {showSeries && series.length > 0 && (
          <div className="pa-sidebar-albums">
            <span className="pa-section-label">シリーズ</span>
            {series.slice(0, 5).map((item) => (
              <Link key={item.id} to={`/series/${item.slug}`}>
                {item.coverUrl && (
                  <img
                    src={srcFor(
                      item.coverUrl,
                      80,
                      70,
                      "webp",
                      item.coverRotationDeg,
                    )}
                    alt=""
                    loading="lazy"
                  />
                )}
                {item.title}
              </Link>
            ))}
          </div>
        )}
        <div className="pa-sidebar-bottom">
          <Link to={english ? "/en/contact" : "/contact"}>
            {english ? "Contact" : "撮影のご相談"}
            <span>↗</span>
          </Link>
          {showService &&
            (showServiceInNav ||
              isServiceOwnerSite(
                settings.siteUrl,
                window.location.hostname,
              )) && (
              <Link to="/portfolio-kit">
                ポートフォリオ制作<span>↗</span>
              </Link>
            )}
          <small>{settings.heroSubtitle}</small>
          <div className="pa-legal">
            <Link to={english ? "/privacy/en" : "/privacy"}>Privacy</Link>
            <Link to={english ? "/terms/en" : "/terms"}>Terms</Link>
          </div>
        </div>
      </aside>
      <section className="pa-workspace">
        <header className="pa-toolbar pa-glass" data-pa-lens>
          <div className="pa-heading">
            {detailPath && (
              <Link
                className="pa-icon"
                to={`/${shelf}`}
                aria-label="一覧に戻る"
              >
                <Icon name="left" />
              </Link>
            )}
            <div>
              {isAbout || isContact ? (
                <div className="pa-toolbar-title">{title}</div>
              ) : (
                <h1>{title}</h1>
              )}
              <p>
                {photoPage
                  ? `${siteName} · ${loading ? "読み込み中" : `${photos.length}枚`}${selected ? "のセレクト" : ""}`
                  : isShelf
                    ? `${activeShelf.length}つの${shelf === "work" ? settings.navLabelWork || "Work" : "シリーズ"}`
                    : settings.siteNameEn}
              </p>
            </div>
          </div>
          <div className="pa-toolbar-actions">
            {photoPage && (
              <>
                <label className="pa-search">
                  <Icon name="search" />
                  <input
                    ref={searchInput}
                    type="search"
                    aria-label="写真を検索"
                    placeholder="写真を検索"
                    value={query}
                    onChange={(event) =>
                      putParams({ q: event.target.value }, true)
                    }
                  />
                </label>
                <button
                  className="pa-icon pa-search-toggle"
                  aria-label={searchOpen ? "検索を閉じる" : "検索を開く"}
                  aria-expanded={searchOpen}
                  onClick={() => {
                    setSearchOpen((value) => !value);
                    if (!searchOpen)
                      requestAnimationFrame(() => searchInput.current?.focus());
                  }}
                >
                  <Icon name="search" />
                </button>
              </>
            )}
            <Link
              className="pa-icon"
              to={english ? "/en/contact" : "/contact"}
              aria-label="撮影のご相談"
            >
              <Icon name="mail" />
            </Link>
            {(isAbout || isContact) &&
              (english || hasPublicEnglishContent(settings)) && (
                <Link
                  className="pa-language"
                  to={`${english ? "" : "/en"}/${isAbout ? "about" : "contact"}`}
                >
                  {english ? "JP" : "EN"}
                </Link>
              )}
          </div>
        </header>
        {photoPage && (
          <div className="pa-controls">
            {!detailPath ? (
              <nav
                className="pa-segmented pa-glass"
                aria-label="写真の範囲"
                style={
                  { "--pa-segment-index": selected ? 0 : 1 } as CSSProperties
                }
              >
                <span aria-hidden="true" />
                <Link to="/" aria-current={selected ? "page" : undefined}>
                  セレクト
                </Link>
                <Link
                  to="/gallery"
                  aria-current={isGallery ? "page" : undefined}
                >
                  すべて
                </Link>
              </nav>
            ) : (
              <span />
            )}
            <div className="pa-view-tools pa-glass">
              <button
                ref={filtersButton}
                className="pa-icon"
                aria-label="写真を絞り込む"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(true)}
                data-active={category !== "all" || medium !== "all"}
              >
                <Icon name="filter" />
              </button>
              <select
                aria-label="写真の並び順"
                value={sort}
                onChange={(event) => putParams({ sort: event.target.value })}
              >
                <option value="curated">展示順</option>
                <option value="newest">撮影日の新しい順</option>
                <option value="oldest">撮影日の古い順</option>
              </select>
              <button
                className="pa-icon"
                aria-label="写真を小さく"
                disabled={effectiveColumns >= (mobile ? 5 : 8)}
                onClick={() => changeColumns(effectiveColumns + 1)}
              >
                <Icon name="photos" />
              </button>
              <input
                className="pa-density"
                type="range"
                aria-label="写真の列数"
                min="2"
                max={mobile ? 5 : 8}
                value={effectiveColumns}
                onChange={(event) => changeColumns(Number(event.target.value))}
              />
              <button
                className="pa-icon"
                aria-label="写真を大きく"
                disabled={effectiveColumns <= 2}
                onClick={() => changeColumns(effectiveColumns - 1)}
              >
                <Icon name="large" />
              </button>
              <output>{effectiveColumns}列</output>
            </div>
          </div>
        )}
        <main
          ref={scroll}
          id="photo-app-content"
          className="pa-scroll"
          tabIndex={-1}
        >
          <div className="pa-page">
            {photoPage ? (
              <>
                {detail &&
                  (detail.series.subtitle || detail.series.statement) && (
                    <details className="pa-series-statement">
                      <summary>
                        {detail.series.subtitle || "このシリーズについて"}
                      </summary>
                      {detail.series.statement && (
                        <p>{detail.series.statement}</p>
                      )}
                    </details>
                  )}
                {loading ? (
                  <output className="pa-loading">写真を読み込んでいます</output>
                ) : failed ? (
                  <ContentStatus state="error" onRetry={retryPhotos} />
                ) : detailPath && !detail ? (
                  <div className="pa-empty">
                    <p>シリーズが見つかりませんでした。</p>
                    <Link to={`/${shelf}`}>一覧に戻る</Link>
                  </div>
                ) : photos.length ? (
                  <>
                    <PhotoAppGallery
                      canvasColor={seriesTheme.bgColor}
                      key={routeKey}
                      ref={gallery}
                      photos={photos}
                      columns={effectiveColumns}
                      scrollRef={scroll}
                      onOpen={openPhoto}
                      routeKey={routeKey}
                    />
                    <p className="pa-end-note">
                      {photos.length}枚の写真 · {siteName}
                    </p>
                  </>
                ) : (
                  <div className="pa-empty">
                    <h2>写真が見つかりませんでした</h2>
                    {(query || category !== "all" || medium !== "all") && (
                      <button
                        onClick={() => putParams({ q: "", c: "", medium: "" })}
                      >
                        検索と絞り込みを解除
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : isShelf ? (
              <>
                {shelfQuery.isPending ? (
                  <output className="pa-loading">読み込み中</output>
                ) : shelfQuery.isError ? (
                  <ContentStatus
                    state="error"
                    onRetry={() => void shelfQuery.refetch()}
                  />
                ) : (
                  <div className="pa-series-grid">
                    {activeShelf.map((item) => (
                      <Link
                        key={item.id}
                        className="pa-series-item"
                        to={`/${shelf}/${item.slug}`}
                      >
                        <div className="pa-series-cover">
                          {item.coverUrl && (
                            <img
                              src={srcFor(
                                item.coverUrl,
                                800,
                                84,
                                "webp",
                                item.coverRotationDeg,
                              )}
                              alt={item.title}
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                        </div>
                        <h2>{item.title}</h2>
                        <p>
                          {item.photoCount
                            ? `${item.photoCount}枚の写真`
                            : item.subtitle}
                          <span>見る ↗</span>
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="pa-reading-page">
                <Suspense
                  fallback={<output className="pa-loading">読み込み中</output>}
                >
                  {isAbout ? (
                    <ProfilePage language={english ? "en" : "ja"} />
                  ) : (
                    <ContactPage language={english ? "en" : "ja"} />
                  )}
                </Suspense>
              </div>
            )}
            <footer className="pa-page-footer">
              <Link to={english ? "/en/contact" : "/contact"}>
                {english ? "Contact ↗" : "撮影のご相談 ↗"}
              </Link>
              {showService && (
                <Link to="/portfolio-kit">ポートフォリオ制作 ↗</Link>
              )}
              <span>
                {settings.footerText ||
                  `© ${new Date().getFullYear()} ${siteName}`}
              </span>
              <Link to={english ? "/privacy/en" : "/privacy"}>Privacy</Link>
              <Link to={english ? "/terms/en" : "/terms"}>Terms</Link>
            </footer>
          </div>
        </main>
        <nav
          className="pa-mobile-nav pa-glass"
          aria-label="モバイルの主なページ"
          style={navStyle}
          data-pa-lens
        >
          <span
            className="pa-nav-indicator"
            aria-hidden="true"
            hidden={!links.some((link) => link.current)}
          />
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              aria-current={link.current ? "page" : undefined}
            >
              <Icon name={link.icon} />
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
      </section>
      <dialog
        ref={filtersDialog}
        className="pa-filter-dialog"
        aria-label="写真を絞り込む"
        onCancel={(event) => {
          event.preventDefault();
          setFiltersOpen(false);
        }}
      >
        <header>
          <h2>写真を絞り込む</h2>
          <button
            className="pa-icon"
            aria-label="絞り込みを閉じる"
            onClick={() => setFiltersOpen(false)}
          >
            <Icon name="close" />
          </button>
        </header>
        <label>
          カテゴリー
          <select
            value={category}
            onChange={(event) => putParams({ c: event.target.value })}
          >
            <option value="all">すべて</option>
            {categoriesQuery.data?.categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          撮影方式
          <select
            value={medium}
            onChange={(event) => putParams({ medium: event.target.value })}
          >
            <option value="all">すべて</option>
            <option value="film">フィルム</option>
            <option value="digital">デジタル</option>
          </select>
        </label>
        <footer>
          <button onClick={() => putParams({ c: "", medium: "" })}>解除</button>
          <button
            className="pa-primary-button"
            onClick={() => setFiltersOpen(false)}
          >
            {photos.length}枚の写真を見る
          </button>
        </footer>
      </dialog>
      {index >= 0 && (
        <PhotoAppViewer
          photos={photos}
          index={index}
          origin={opener.current}
          onClose={closePhoto}
          onMove={movePhoto}
          seriesLinks={seriesLinks}
        />
      )}
    </div>
  );
}
