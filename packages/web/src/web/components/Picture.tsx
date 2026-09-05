import { srcSetFor, srcFor, type ImagePreset } from "../lib/picture";
import { heroGeneratedSrcSet } from "../../shared/hero-responsive";

type PictureProps = {
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  width?: number | null;
  height?: number | null;
  rotationDeg?: number | null;
  alt: string;
  preset: ImagePreset;
  sizes: string;
  fallbackW: number;
  fallbackQ: number;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  onLoad?: () => void;
  onError?: () => void;
  draggable?: boolean;
  imgRef?: React.Ref<HTMLImageElement>;
};

export function Picture({
  url, thumbUrl, mediumUrl, width, height, rotationDeg, alt, preset, sizes, fallbackW, fallbackQ,
  className, style, loading, fetchPriority, onLoad, onError, draggable, imgRef,
}: PictureProps) {
  const generatedSrcSet = heroGeneratedSrcSet({
    url,
    thumbUrl,
    mediumUrl,
    width,
    height,
    rotationDeg,
  });
  return (
    <picture>
      {!mediumUrl && !generatedSrcSet && (
        <>
          <source
            type="image/avif"
            srcSet={srcSetFor(url, preset, "avif", rotationDeg)}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={srcSetFor(url, preset, "webp", rotationDeg)}
            sizes={sizes}
          />
        </>
      )}
      <img
        ref={imgRef}
        src={
          mediumUrl ??
          srcFor(url, fallbackW, fallbackQ, undefined, rotationDeg)
        }
        srcSet={
          generatedSrcSet ||
          (mediumUrl
            ? undefined
            : srcSetFor(url, preset, undefined, rotationDeg))
        }
        sizes={sizes}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        fetchPriority={fetchPriority}
        onLoad={onLoad}
        onError={onError}
        draggable={draggable}
        decoding="async"
      />
    </picture>
  );
}
