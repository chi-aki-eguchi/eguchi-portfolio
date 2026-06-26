import { srcSetFor, srcFor, type ImagePreset } from "../lib/picture";

type PictureProps = {
  url: string;
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
  url, rotationDeg, alt, preset, sizes, fallbackW, fallbackQ,
  className, style, loading, fetchPriority, onLoad, onError, draggable, imgRef,
}: PictureProps) {
  return (
    <picture>
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
      <img
        ref={imgRef}
        src={srcFor(url, fallbackW, fallbackQ, undefined, rotationDeg)}
        srcSet={srcSetFor(url, preset, undefined, rotationDeg)}
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
