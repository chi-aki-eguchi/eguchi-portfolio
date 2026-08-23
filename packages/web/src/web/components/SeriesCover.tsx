import { useRef } from "react";
import { useBreakoutRoom } from "../hooks/useBreakoutRoom";
import { imageUrlWithParams } from "../../shared/image-url";

export type SeriesCoverData = {
  coverUrl?: string | null;
  coverRotationDeg?: number | null;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
};

/**
 * The opening spread of a body of work.
 *
 * Series detail used to begin with the title set in text on empty paper and
 * then run straight into the photographs — 118 frames and 25,000px of scroll
 * on `ishigakiisland`, with no opening and no pause. Meanwhile the cover the
 * owner had already chosen (`coverPhotoId`) was shown on the Series *list* and
 * then never again.
 *
 * So: open on the cover, at the page's full width, with the title set over it.
 * That is the 巻頭グラビア `design-spec.md` §1-1 asks for, and it costs no new
 * data — the detail page already holds the list response for its next-series
 * link.
 *
 * **Renders nothing without a cover.** A Portfolio Kit site starts with no
 * photographs at all, and `site-and-data-direction.md` §0 asks what the empty
 * case looks like: it looks like the quiet text header that was there before,
 * not like an empty grey rectangle.
 */
export function SeriesCover({
  series,
  title,
  subtitle,
}: {
  series: SeriesCoverData | undefined;
  title: string;
  subtitle?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const room = useBreakoutRoom(ref);
  const url = series?.coverUrl;
  if (!url) return null;

  // Break out of the text column, but only as far as the page actually has
  // room. Capped so an ultrawide monitor gets a spread, not a billboard.
  const width = room.available > 0 ? Math.min(room.available, 1600) : 0;
  const frame =
    width > room.natural
      ? {
          width: `${Math.round(width)}px`,
          marginInline: `calc((100% - ${Math.round(width)}px) / 2)`,
        }
      : undefined;

  const focalX = series?.coverFocalX ?? 50;
  const focalY = series?.coverFocalY ?? 50;

  return (
    <div ref={ref} style={frame} className="series-cover page-entrance">
      <div className="series-cover__frame">
        <img
          // Rotation is applied by the image pipeline, not by a CSS transform:
          // rotating the element would turn the frame with it and leave the
          // corners empty.
          src={imageUrlWithParams(url, {
            w: 1800,
            q: 82,
            rotationDeg: series?.coverRotationDeg ?? 0,
          })}
          alt=""
          // Decorative: the title beside it names the series, and the
          // photographs below carry their own alt text. Announcing the same
          // name twice is noise on a screen reader.
          aria-hidden="true"
          className="series-cover__img"
          style={{ objectPosition: `${focalX}% ${focalY}%` }}
          decoding="async"
          fetchPriority="high"
        />
        <div className="series-cover__scrim" aria-hidden="true" />
        <div className="series-cover__caption">
          <h1 className="series-cover__title font-ja">{title}</h1>
          {subtitle && (
            <p className="series-cover__subtitle font-en">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
