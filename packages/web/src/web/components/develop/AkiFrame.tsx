import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  EXHIBITION_NICHIGEI_SLUG,
  exhibitionDisplayTitle,
  exhibitionEntryPhotos,
  exhibitionPath,
  publicExhibitions,
} from "../../../shared/exhibitions";
import { api, jsonOrThrow } from "../../lib/api";
import { loadPhotos } from "../../lib/early-photos";
import { entranceCover } from "../../lib/rintaro-entrance";
import { sortPhotosBySetting } from "../../lib/photo-sort";
import { seriesHref } from "../../lib/series-links";
import { lockPageScroll } from "../../lib/scroll-lock";
import { AkiEdition, rememberAkiGallerySpot, type AkiSettings, type AkiWork } from "./aki-edition";
import "./aki-edition.css";

const pages = [
  { href: "/gallery", title: "Gallery" },
  { href: "/info", title: "プロフィール" },
  { href: "/portrait", title: "Portrait" },
  { href: "/info#request", title: "撮影依頼" },
];

export function AkiFrame({ children, settings }: { children: ReactNode; settings: AkiSettings }) {
  const [path] = useLocation();
  const series = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const works = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const library = useQuery({ queryKey: ["photos"], queryFn: loadPhotos, enabled: path === "/" });
  const entries = useMemo<AkiWork[]>(() => {
    const photos = library.data?.photos ?? [];
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    const firstBySeries = new Map<number, (typeof photos)[number]>();
    for (const photo of sortPhotosBySetting(photos, settings.seriesSortOrder)) {
      for (const id of [photo.seriesId, ...(photo.seriesIds ?? [])]) {
        if (id != null && !firstBySeries.has(id)) firstBySeries.set(id, photo);
      }
    }
    const shows = publicExhibitions(settings, window.location.hostname);
    const lead = shows.find((show) => show.slug === EXHIBITION_NICHIGEI_SLUG);
    const ordered = lead ? [lead, ...shows.filter((show) => show !== lead)] : shows;
    return [
      ...ordered.map((show) => ({
        href: exhibitionPath(show.slug),
        title: exhibitionDisplayTitle(show),
        photo: exhibitionEntryPhotos(show, photos)[0] ?? null,
      })),
      ...[
        ...(series.data?.series ?? []),
        ...(works.data?.series ?? []).map((row) => ({ ...row, kind: "work" })),
      ].map((row) => {
        const cover = entranceCover(row, photos, settings.siteUrl);
        const photo = byId.get(cover.coverPhotoId ?? 0);
        return {
          href: seriesHref(row),
          title: row.title,
          photo:
            photo ??
            (cover.coverUrl
              ? {
                  url: cover.coverUrl,
                  width: cover.coverWidth,
                  height: cover.coverHeight,
                  rotationDeg: cover.coverRotationDeg,
                }
              : (firstBySeries.get(row.id) ?? null)),
        };
      }),
    ];
  }, [settings, library.data, series.data, works.data]);
  const sources = [series, works, library];
  const edition = {
    exhibitionOnTop: settings.exhibitionOnTop === "on",
    name: settings.profileName || settings.siteName || "江口秋",
    entries,
    pending: sources.some((q) => q.isPending),
    failed: sources.some((q) => q.isError && !q.data),
    retry: () => {
      for (const q of sources) if (q.isError) void q.refetch();
    },
  };

  const dialog = useRef<HTMLDialogElement>(null);
  const menuPaper = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    dialog.current?.close();
  }, [path]);
  useEffect(() => (open ? lockPageScroll() : undefined), [open]);

  const currentHref = path === "/info" && window.location.hash === "#request" ? "/info#request" : path;
  const links = (rows: { href: string; title: string }[]) =>
    rows.map((row) => {
      const current = currentHref === row.href;
      return (
        <li key={row.href}>
          <Link
            to={row.href}
            aria-current={current ? "page" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              dialog.current?.close();
              // wouter changes the hash without scrolling when the page is already mounted.
              if (row.href.startsWith(path + "#")) {
                const id = row.href.slice(path.length + 1);
                requestAnimationFrame(() =>
                  document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" }),
                );
              }
            }}
          >
            {row.title}
          </Link>
        </li>
      );
    });
  const galleryReturn = window.history.state?.akiGallery;
  const fromGallery = !!galleryReturn && /^\/(?:series|work)\//.test(path);
  return (
    <AkiEdition.Provider value={edition}>
      <div className="aki-edition">
        <a className="aki-skip" href="#main-content">
          本文へ
        </a>
        <header className="aki-head">
          {fromGallery ? (
            <button
              type="button"
              className="aki-return"
              aria-label="Galleryの元の位置に戻る"
              onClick={() => history.back()}
            >
              ←　Gallery
            </button>
          ) : (
            <Link
              to="/"
              className="aki-name"
              onClick={() => rememberAkiGallerySpot()}
              aria-label={`${settings.siteName} 作品へ`}
            >
              {settings.profileName || settings.siteName}
            </Link>
          )}
          <button
            type="button"
            className="aki-menu-button"
            ref={openButton}
            aria-label="目次を開く"
            aria-controls="aki-menu"
            aria-expanded={open}
            onClick={(event) => {
              rememberAkiGallerySpot();
              dialog.current?.showModal();
              if (event.detail > 0) menuPaper.current?.focus({ preventScroll: true });
              setOpen(true);
            }}
          >
            <span className="aki-menu-hint" aria-hidden="true">
              目次
            </span>
            <i aria-hidden="true" />
          </button>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        {path === "/info" && (
          <footer className="aki-policies">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">利用条件</Link>
          </footer>
        )}
        <dialog
          ref={dialog}
          id="aki-menu"
          className="aki-menu"
          aria-label="目次"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
          onClose={() => {
            setOpen(false);
            if (document.activeElement === document.body) openButton.current?.focus({ preventScroll: true });
          }}
        >
          <div className="aki-menu-paper" ref={menuPaper} tabIndex={-1}>
            <button
              className="aki-menu-button"
              type="button"
              aria-label="目次を閉じる"
              onClick={() => dialog.current?.close()}
            >
              <i aria-hidden="true" />
            </button>
            <nav aria-label="ページを選ぶ">
              <ul className="aki-menu-works">{links(entries)}</ul>
              <ul className="aki-menu-pages">{links(pages)}</ul>
            </nav>
          </div>
        </dialog>
      </div>
    </AkiEdition.Provider>
  );
}
