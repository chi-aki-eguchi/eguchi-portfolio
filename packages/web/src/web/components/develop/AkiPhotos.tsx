import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { photoAltText } from "../../../shared/photo-alt";
import { contactHrefForWork } from "../../../shared/contact-reference";
import { useSeriesLinks } from "../../hooks/useSeriesLinks";
import { computeJustifiedRows, justifiedRatio } from "../../lib/justified-layout";
import { loadPhotos } from "../../lib/early-photos";
import { shuffleWithSeed } from "../../lib/shuffle";
import { rememberAkiGallerySpot, useAkiEdition } from "./aki-edition";
import { ContentStatus } from "../ContentStatus";
import { Picture } from "../Picture";
import type { GalleryPhoto } from "../PhotoGallery";
import { PhotoViewer, usePhotoViewer } from "../photo-site/viewer";

const mixSeed = 20261119;

function Plates({
  photos,
  title,
  mode,
}: {
  photos: GalleryPhoto[];
  title?: string;
  mode: "gallery" | "work";
}) {
  const node = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const viewer = usePhotoViewer(photos, mode === "gallery");
  const restored = useRef(false);
  const links = useSeriesLinks();
  const individual = mode === "work" && photos.length <= 12;
  const hasWidth = width > 0;
  useLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    let measuredWidth = el.clientWidth;
    setWidth(measuredWidth);
    // Observe after the first rows exist. Their initial height change used to trigger a WebKit resize loop.
    if (!hasWidth && measuredWidth) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const nextWidth = el.clientWidth;
      if (nextWidth === measuredWidth) return;
      measuredWidth = nextWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(nextWidth));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hasWidth]);
  const gap = width < 650 ? 6 : 10;
  const rows = useMemo(() => {
    if (!width || individual) return [];
    return computeJustifiedRows(photos, {
      containerWidth: width,
      gap,
      baseRowHeight: mode === "gallery" ? (width < 500 ? 150 : 210) : width < 500 ? 230 : 340,
    });
  }, [width, gap, photos, individual, mode]);
  useLayoutEffect(() => {
    if (!width || restored.current) return;
    restored.current = true;
    const state = history.state;
    if (mode === "gallery" && state?.akiSpot?.path === location.pathname + location.search) {
      window.scrollTo({ top: state.akiSpot.y, behavior: "instant" });
    } else if (mode === "work" && /^#photo-\d+$/.test(location.hash)) {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [width, mode]);

  const tile = (index: number, tileWidth?: number) => {
    const photo = photos[index]!;
    const alt = photoAltText(photo, { seriesName: title ?? links[photo.seriesId ?? 0]?.name });
    return (
      <button
        type="button"
        key={photo.id}
        id={mode === "work" ? `photo-${photo.id}` : undefined}
        data-photo-tile={photo.id}
        className={individual ? "aki-work-photo" : undefined}
        aria-label={alt + "を大きく見る"}
        style={
          individual
            ? ({ "--ar": justifiedRatio(photo) } as CSSProperties)
            : { width: tileWidth, height: "100%" }
        }
        onClick={() => {
          if (mode === "gallery") rememberAkiGallerySpot(photo.id);
          viewer.open(index);
        }}
      >
        <Picture
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          mediumUrl={photo.mediumUrl}
          width={photo.width}
          height={photo.height}
          rotationDeg={photo.rotationDeg}
          alt={alt}
          preset="grid"
          sizes={tileWidth ? Math.ceil(tileWidth) + "px" : "(min-width: 900px) 72vw, 92vw"}
          fallbackW={individual ? 1200 : 640}
          fallbackQ={84}
          loading={index < 4 ? "eager" : "lazy"}
          draggable={false}
        />
      </button>
    );
  };

  return (
    <>
      <div
        className={individual ? "aki-plates" : "aki-photos"}
        ref={node}
        style={individual ? undefined : { gap }}
      >
        {individual
          ? photos.map((_, i) => tile(i))
          : rows.map((row) => (
              <div
                key={row.items[0]!.index}
                className="aki-photos-row"
                style={{ height: row.height, columnGap: gap }}
              >
                {row.items.map((item) => tile(item.index, item.width))}
              </div>
            ))}
      </div>
      <PhotoViewer photos={photos} viewer={viewer} seriesName={title} seriesLinkById={links} />
    </>
  );
}

export function AkiGallery() {
  const query = useQuery({ queryKey: ["photos"], queryFn: loadPhotos });
  const search = useSearch();
  const params = new URLSearchParams(search);
  const c = params.get("c");
  const medium = params.get("medium");
  // Old filtered links referred to the single-photo shelf.
  const singles = params.get("shelf") === "singles" || (!params.has("shelf") && !!(c || medium));
  const shown = useMemo(() => {
    const photos = (query.data?.photos ?? []).filter((photo) => {
      const grouped = photo.seriesId != null || !!photo.seriesIds?.length;
      return (
        grouped !== singles &&
        (!c || c === "all" || c === photo.category) &&
        (medium !== "digital" || photo.filmType === "デジタル") &&
        (medium !== "film" || photo.filmType === "フィルム")
      );
    });
    return shuffleWithSeed(photos, mixSeed);
  }, [query.data, singles, c, medium]);
  // The next deliberate scroll supersedes the position that opened the photograph.
  useEffect(() => {
    const resumeBrowsing = () => {
      const state = window.history.state;
      if (!state?.akiSpot || state.lightbox || document.querySelector("dialog[open]")) return;
      const next = { ...state };
      delete next.akiSpot;
      window.history.replaceState(next, "");
    };
    const events = ["wheel", "touchmove", "keydown"] as const;
    for (const name of events) window.addEventListener(name, resumeBrowsing, { passive: true });
    return () => { for (const name of events) window.removeEventListener(name, resumeBrowsing); };
  }, []);
  return (
    <section className="aki-gallery">
      <h1 className="sr-only">Gallery</h1>
      <nav className="aki-switch" aria-label="表示する写真">
        <Link to="/gallery" aria-current={!singles ? "page" : undefined}>
          作品から
        </Link>
        <Link to="/gallery?shelf=singles" aria-current={singles ? "page" : undefined}>
          一枚ずつ
        </Link>
      </nav>
      {query.isPending ? (
        <ContentStatus state="loading" />
      ) : query.isError ? (
        <ContentStatus state="error" error={query.error} onRetry={() => void query.refetch()} />
      ) : shown.length ? (
        <Plates key={singles ? "singles" : "series"} photos={shown} mode="gallery" />
      ) : (
        <p>該当する写真はありません。</p>
      )}
    </section>
  );
}

export function AkiOnward({ path }: { path: string }) {
  const edition = useAkiEdition();
  const index = edition?.entries.findIndex((row) => row.href === path) ?? -1;
  const next = index < 0 ? undefined : edition?.entries[index + 1];
  return (
    <Link to={next?.href ?? "/"} className="aki-onward">
      {next?.title ?? "作品一覧"}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export function AkiProject({
  series,
  photos,
}: {
  series: {
    title: string;
    slug: string;
    subtitle?: string | null;
    statement?: string | null;
    kind?: string | null;
  };
  photos: GalleryPhoto[];
}) {
  const [path] = useLocation();
  return (
    <article className="aki-project">
      <header>
        <h1 className="aki-section-title">{series.title}</h1>
        {series.subtitle && <p className="aki-date">{series.subtitle}</p>}
      </header>
      {series.statement && <p className="aki-statement">{series.statement}</p>}
      {photos.length ? (
        <Plates photos={photos} title={series.title} mode="work" />
      ) : (
        <p>この作品にはまだ写真がありません。</p>
      )}
      <nav className="aki-end" aria-label="作品の続き">
        <AkiOnward path={path} />
        {series.kind === "work" && <Link to={contactHrefForWork(series.slug, "info")}>撮影を相談</Link>}
      </nav>
    </article>
  );
}
