import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAppThumb } from "./PhotoAppGallery";
import { PhotoAppIcon as Icon } from "./PhotoAppIcons";
import { photoSrcFor } from "../../lib/picture";
import { photoAltText } from "../../../shared/photo-alt";

export function PhotoAppViewer({
  photos,
  index,
  onClose,
  onMove,
  origin,
  seriesLinks,
}: {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onMove: (index: number) => void;
  origin: DOMRect | null;
  seriesLinks: Record<number, { title: string; href: string }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    image = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null),
    infoButton = useRef<HTMLButtonElement>(null),
    infoClose = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onClose, onMove, index });
  callbacks.current = { onClose, onMove, index };
  const [info, setInfo] = useState(false),
    [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState<{ id: number; src: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const strip = useRef<HTMLDivElement>(null),
    original = useRef(origin),
    opened = useRef(false);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const photo = photos[index],
    infoRef = useRef(info);
  infoRef.current = info;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    const cancel = (event: Event) => {
      event.preventDefault();
      if (infoRef.current) {
        setInfo(false);
        infoButton.current?.focus();
      } else callbacks.current.onClose();
    };
    element.addEventListener("cancel", cancel);
    return () => {
      element.removeEventListener("cancel", cancel);
      element.close();
    };
  }, []);
  useEffect(() => {
    let live = true;
    setFailed(false);
    setZoom(false);
    const preload = new Image();
    preload.decoding = "async";
    preload.onload = () => {
      if (live) setLoaded({ id: photo.id, src: preload.src });
    };
    preload.onerror = () => {
      if (live) setFailed(true);
    };
    const source = photo.mediumUrl || photoSrcFor(photo, 1600, 85, "webp");
    preload.src = retry
      ? source + (source.includes("?") ? "&" : "?") + "retry=" + retry
      : source;
    // Only the immediate next photograph is prefetched, after the active one.
    const next = photos[index + 1];
    const previousLoad = preload.onload;
    preload.onload = (event) => {
      previousLoad?.call(preload, event);
      if (
        !live ||
        !next ||
        (navigator as Navigator & { connection?: { saveData?: boolean } })
          .connection?.saveData
      )
        return;
      const hint = new Image();
      hint.decoding = "async";
      hint.fetchPriority = "low";
      hint.src = photoAppThumb(next);
    };
    return () => {
      live = false;
      preload.onload = null;
      preload.onerror = null;
    };
  }, [photo, index, photos, retry]);
  useLayoutEffect(() => {
    if (!image.current) return;
    const node = image.current;
    let animation: Animation | undefined;
    if (!reduced()) {
      const from = !opened.current ? original.current : null;
      const box = node.getBoundingClientRect();
      if (from && box.width && box.height) {
        animation = node.animate(
          [
            {
              opacity: 0.5,
              transform: `translate(${from.left + from.width / 2 - box.left - box.width / 2}px, ${from.top + from.height / 2 - box.top - box.height / 2}px) scale(${Math.min(from.width / box.width, from.height / box.height)})`,
            },
            { opacity: 1, transform: "none" },
          ],
          { duration: 260, easing: "cubic-bezier(.2,.7,.25,1)" },
        );
      } else
        animation = node.animate(
          [
            { opacity: 0.6, transform: "translateX(8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 160, easing: "ease-out" },
        );
    }
    opened.current = true;
    const selected = strip.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    if (selected && strip.current)
      strip.current.scrollLeft =
        selected.offsetLeft -
        strip.current.offsetLeft -
        strip.current.clientWidth / 2 +
        selected.offsetWidth / 2;
    return () => animation?.cancel();
  }, [photo.id]);
  useEffect(() => {
    if (info) infoClose.current?.focus({ preventScroll: true });
  }, [info]);
  const currentSource = loaded?.id === photo.id ? loaded.src : null;
  const fullSource = zoom
    ? photoSrcFor(photo, 2400, 90, "webp")
    : currentSource;
  const link = photo.seriesId == null ? null : seriesLinks[photo.seriesId];
  const date = photo.shotAt?.slice(0, 10).replace(/-/g, " / ");
  const title = photo.title || date || photo.filmType || "写真";
  const hideInfo = () => {
    setInfo(false);
    infoButton.current?.focus({ preventScroll: true });
  };
  const fields = [
    ["撮影日", date],
    ["カメラ", photo.camera],
    ["レンズ", photo.lens],
    ["媒体", photo.filmType],
    [
      "サイズ",
      photo.width && photo.height ? `${photo.width} × ${photo.height}` : null,
    ],
  ];

  return (
    <dialog
      ref={dialog}
      className="pa-viewer"
      aria-label="写真ビューア"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const next = index + (event.key === "ArrowLeft" ? -1 : 1);
          if (photos[next]) onMove(next);
        }
      }}
    >
      <header className="pa-viewer-toolbar">
        <button
          ref={closeButton}
          className="pa-glass pa-glass-dark pa-back"
          onClick={onClose}
        >
          <Icon name="left" />
          <span>一覧に戻る</span>
        </button>
        <div className="pa-glass pa-glass-dark pa-viewer-heading">
          <span aria-live="polite">
            {index + 1} / {photos.length}
          </span>
          <small>{title}</small>
        </div>
        <div className="pa-viewer-tools">
          <button
            className="pa-glass pa-glass-dark pa-icon pa-zoom-button"
            aria-label={zoom ? "写真全体を表示" : "写真を拡大"}
            aria-pressed={zoom}
            onClick={() => setZoom((value) => !value)}
          >
            <Icon name="zoom" />
          </button>
          <button
            ref={infoButton}
            className="pa-glass pa-glass-dark pa-icon"
            aria-label="写真の情報"
            aria-expanded={info}
            onClick={() => (info ? hideInfo() : setInfo(true))}
          >
            <Icon name="info" />
          </button>
        </div>
      </header>
      <div
        className={`pa-stage${zoom ? " is-zoomed" : ""}`}
        onTouchStart={(event) => {
          gesture.current =
            !zoom && event.touches.length === 1
              ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
              : null;
        }}
        onTouchEnd={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x,
            dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const next = index + (dx < 0 ? 1 : -1);
            if (photos[next]) onMove(next);
          }
        }}
      >
        <div
          ref={image}
          className="pa-image-frame"
          style={zoom ? { minWidth: "160%", minHeight: "160%" } : undefined}
        >
          <img
            src={photoAppThumb(photo)}
            alt={photoAltText(photo)}
            draggable={false}
          />
          {fullSource && (
            <img
              key={fullSource}
              className="pa-full-image"
              src={fullSource}
              alt=""
              draggable={false}
              onError={() => setFailed(true)}
            />
          )}
        </div>
        {failed && (
          <button
            className="pa-image-retry"
            onClick={() => setRetry((value) => value + 1)}
          >
            大きな写真を再読み込み
          </button>
        )}
      </div>
      <button
        className="pa-photo-arrow pa-prev pa-glass pa-glass-dark"
        disabled={index === 0}
        aria-label="前の写真"
        onClick={() => onMove(index - 1)}
      >
        <Icon name="left" />
      </button>
      <button
        className="pa-photo-arrow pa-next pa-glass pa-glass-dark"
        disabled={index === photos.length - 1}
        aria-label="次の写真"
        onClick={() => onMove(index + 1)}
      >
        <Icon name="right" />
      </button>
      <footer className="pa-viewer-bottom pa-glass pa-glass-dark">
        <div className="pa-filmstrip" ref={strip} aria-label="前後の写真">
          {photos.slice(Math.max(0, index - 5), index + 6).map((candidate) => (
            <button
              key={candidate.id}
              aria-label={`写真 ${photos.indexOf(candidate) + 1}`}
              aria-current={candidate.id === photo.id}
              onClick={() => onMove(photos.indexOf(candidate))}
            >
              <img src={photoAppThumb(candidate)} alt="" decoding="async" />
            </button>
          ))}
        </div>
      </footer>
      {info && (
        <aside
          className="pa-photo-info pa-glass pa-glass-dark"
          aria-label="写真の情報"
        >
          <header>
            <h2>写真の情報</h2>
            <button
              ref={infoClose}
              className="pa-icon"
              aria-label="情報を閉じる"
              onClick={hideInfo}
            >
              <Icon name="close" />
            </button>
          </header>
          {photo.title && <p>{photo.title}</p>}
          {photo.description && (
            <p className="pa-description">{photo.description}</p>
          )}
          <dl>
            {fields
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          {link && <Link to={link.href}>{link.title} ↗</Link>}
          <Link to={`/photo/${photo.id}`} className="pa-photo-permalink">
            この写真のページ ↗
          </Link>
        </aside>
      )}
    </dialog>
  );
}
