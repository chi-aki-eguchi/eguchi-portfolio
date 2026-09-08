import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GalleryPhoto } from "../PhotoGallery";
import {
  buildPhotoAppRows,
  photoAppArrowIndex,
  visiblePhotoAppRows,
} from "../../lib/photo-app-layout";
import { photoSrcFor } from "../../lib/picture";
import { photoAltText } from "../../../shared/photo-alt";

export type PhotoAppGalleryHandle = {
  reveal: (id: number, focus?: boolean) => void;
};
export const photoAppThumb = (photo: GalleryPhoto) =>
  photo.thumbUrl || photo.mediumUrl || photoSrcFor(photo, 480, 82, "webp");

const Thumbnail = memo(function Thumbnail({
  photo,
  eager,
  first,
}: {
  photo: GalleryPhoto;
  eager: boolean;
  first: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const sources = [
    ...new Set(
      [
        photoAppThumb(photo),
        photo.mediumUrl,
        photoSrcFor(photo, 480, 82, "webp"),
      ].filter((url): url is string => Boolean(url)),
    ),
  ];
  if (attempt >= sources.length)
    return <span className="pa-thumb-error">写真を開いて再読み込み</span>;
  return (
    <img
      src={sources[attempt]}
      alt={photoAltText(photo)}
      width={photo.width || undefined}
      height={photo.height || undefined}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={first ? "high" : "auto"}
      draggable={false}
      onError={() => setAttempt((value) => value + 1)}
    />
  );
});

/** Only nearby rows are mounted. Scrolling never lays out all photograph DOM nodes. */
export const PhotoAppGallery = forwardRef<
  PhotoAppGalleryHandle,
  {
    photos: GalleryPhoto[];
    columns: number;
    scrollRef: RefObject<HTMLElement | null>;
    onOpen: (photo: GalleryPhoto, button: HTMLButtonElement) => void;
    routeKey: string;
    canvasColor?: string;
  }
>(
  (
    { photos, columns, scrollRef, onOpen, routeKey, canvasColor },
    handleRef,
  ) => {
    const grid = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const rows = useMemo(
      () => buildPhotoAppRows(photos, width, columns, 3),
      [photos, width, columns],
    );
    const [range, setRange] = useState({ start: 0, end: 6 });
    const pendingFocus = useRef<number | null>(null);
    const previous = useRef<{ rows: typeof rows; ids: number[]; key: string }>({
      rows: [],
      ids: [],
      key: routeKey,
    });
    const updateRange = useCallback(() => {
      const container = scrollRef.current,
        element = grid.current;
      if (!container || !element) return;
      const relativeTop = container.scrollTop - element.offsetTop;
      const next = visiblePhotoAppRows(
        rows,
        relativeTop,
        container.clientHeight,
        Math.min(650, container.clientHeight),
      );
      setRange((current) =>
        current.start === next.start && current.end === next.end
          ? current
          : next,
      );
    }, [rows, scrollRef]);
    useLayoutEffect(() => {
      const element = grid.current;
      if (!element) return;
      setWidth(Math.round(element.getBoundingClientRect().width));
      const observer = new ResizeObserver((entries) => {
        const next = Math.round(entries[0].contentRect.width);
        setWidth((current) => (current === next ? current : next));
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
      const container = scrollRef.current,
        element = grid.current,
        old = previous.current;
      if (
        container &&
        element &&
        old.key === routeKey &&
        old.rows.length &&
        old.rows !== rows &&
        old.ids.length === photos.length &&
        old.ids[0] === photos[0]?.id
      ) {
        const chrome =
          parseFloat(getComputedStyle(container).scrollPaddingTop) || 150;
        const relativeTop = container.scrollTop - element.offsetTop + chrome;
        const anchorRow = old.rows.find(
          (row) => row.top + row.height > relativeTop,
        );
        const anchorId = anchorRow && old.ids[anchorRow.start];
        const index = photos.findIndex((photo) => photo.id === anchorId);
        const nextRow = rows.find(
          (row) => index >= row.start && index < row.end,
        );
        if (anchorRow && nextRow)
          container.scrollTop += nextRow.top - anchorRow.top;
      }
      previous.current = {
        rows,
        ids: photos.map((photo) => photo.id),
        key: routeKey,
      };
      updateRange();
    }, [rows, photos, routeKey, scrollRef, updateRange]);
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      let frame = 0;
      const scroll = () => {
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            updateRange();
          });
      };
      container.addEventListener("scroll", scroll, { passive: true });
      return () => {
        container.removeEventListener("scroll", scroll);
        cancelAnimationFrame(frame);
      };
    }, [scrollRef, updateRange]);
    const reveal = useCallback(
      (id: number, focus = true) => {
        const index = photos.findIndex((photo) => photo.id === id);
        const row = rows.find(
          (candidate) => index >= candidate.start && index < candidate.end,
        );
        const container = scrollRef.current,
          element = grid.current;
        if (!row || !container || !element) return;
        const style = getComputedStyle(container);
        const topInset = parseFloat(style.scrollPaddingTop) || 150,
          bottomInset = parseFloat(style.scrollPaddingBottom) || 32;
        const top = row.top + element.offsetTop,
          bottom = top + row.height;
        if (top < container.scrollTop + topInset)
          container.scrollTop = top - topInset;
        else if (
          bottom >
          container.scrollTop + container.clientHeight - bottomInset
        )
          container.scrollTop = Math.min(
            top - topInset,
            bottom - container.clientHeight + bottomInset,
          );
        if (focus) pendingFocus.current = id;
        updateRange();
        // Already-mounted destinations need no React render to receive focus.
        const button = element.querySelector<HTMLButtonElement>(
          `[data-photo-tile="${id}"]`,
        );
        if (focus && button) {
          pendingFocus.current = null;
          button.focus({ preventScroll: true });
        }
      },
      [photos, rows, scrollRef, updateRange],
    );
    useImperativeHandle(handleRef, () => ({ reveal }), [reveal]);
    useLayoutEffect(() => {
      const id = pendingFocus.current;
      if (id == null) return;
      const button = grid.current?.querySelector<HTMLButtonElement>(
        `[data-photo-tile="${id}"]`,
      );
      if (button) {
        pendingFocus.current = null;
        button.focus({ preventScroll: true });
      }
    }, [range]);
    const last = rows[rows.length - 1],
      height = last ? last.top + last.height : 0;
    return (
      <div
        ref={grid}
        className="pa-grid"
        style={{ height, backgroundColor: canvasColor }}
        aria-label="写真の一覧"
        data-photo-count={photos.length}
      >
        {rows.slice(range.start, range.end).map((row) => (
          <div
            className="pa-photo-row"
            key={row.start}
            style={{ top: row.top, height: row.height }}
          >
            {row.items.map((item) => {
              const photo = photos[item.index];
              return (
                <button
                  className="pa-photo-tile"
                  key={photo.id}
                  data-photo-tile={photo.id}
                  style={{
                    left: item.left,
                    width: item.width,
                    height: row.height,
                  }}
                  aria-label={`${photo.title || `写真 ${item.index + 1}`}を開く`}
                  onClick={(event) => onOpen(photo, event.currentTarget)}
                  onFocus={() => {
                    if (!document.querySelector(".pa-viewer[open]"))
                      reveal(photo.id, false);
                  }}
                  onKeyDown={(event) => {
                    const direction = (
                      {
                        ArrowLeft: "left",
                        ArrowRight: "right",
                        ArrowUp: "up",
                        ArrowDown: "down",
                      } as const
                    )[event.key as "ArrowLeft"];
                    if (direction) {
                      event.preventDefault();
                      const target =
                        photos[photoAppArrowIndex(rows, item.index, direction)];
                      if (target) reveal(target.id);
                    }
                  }}
                >
                  <Thumbnail
                    photo={photo}
                    eager={item.index < columns * 2}
                    first={item.index === 0}
                  />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);
