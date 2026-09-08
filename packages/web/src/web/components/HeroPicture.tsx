import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";
import { heroGeneratedSrcSet } from "../../shared/hero-responsive";

export function HeroPicture({
  url,
  thumbUrl,
  mediumUrl,
  width,
  height,
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
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  width?: number | null;
  height?: number | null;
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
  const generatedSrcSet = heroGeneratedSrcSet({
    url,
    thumbUrl,
    mediumUrl,
    width,
    height,
    rotationDeg,
  });
  const finalSrc = mediumUrl ?? srcFor(url, 1536, 88, undefined, rotationDeg);
  return (
    <picture>
      {!mediumUrl && !generatedSrcSet && (
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
        srcSet={
          generatedSrcSet ||
          (mediumUrl
            ? undefined
            : srcSetFor(url, "hero", undefined, rotationDeg))
        }
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
