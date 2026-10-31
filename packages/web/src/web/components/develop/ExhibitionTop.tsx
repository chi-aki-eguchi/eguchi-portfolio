import { Picture } from "../Picture";
import { JaPhrases } from "../JaPhrases";
import type { GalleryPhoto } from "../PhotoGallery";
import { useScrollFadeIn } from "../../hooks/useScrollFadeIn";
import { orientedDimensions } from "../../../shared/image-url";
import { exhibitionShape, type ExhibitionPhoto } from "../../../shared/exhibition";
import { photoAltText } from "../../../shared/photo-alt";
import type { PhotoViewerState } from "../photo-site/viewer";
import "./exhibition.css";

export type ExhibitionItem = GalleryPhoto | ExhibitionPhoto;

/**
 * 表紙の下の札。展示の壁で作品の横に添える札と同じで、誰の・どの展示の写真かだけを置く。
 * 名前は表紙の部品と同じ物（pages/top.tsx の ClassicHeroNameBlock）を受け取る。
 */
export function ExhibitionLabel({
  name,
  title,
  dates,
}: {
  name: React.ReactNode;
  title: string;
  dates: string;
}) {
  return (
    <div className="ex-label">
      <div className="ex-label__name">{name}</div>
      {(title || dates) && (
        <div className="ex-label__show">
          {title && <h2 className="hero-text-reveal hero-text-reveal-2">{title}</h2>}
          {dates && <p className="hero-text-reveal hero-text-reveal-3">{dates}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * 表紙に続く写真。1枚ずつ、切り抜かず、地の紙の上に置く。写真の上には何も重ねない。
 * 枚数が増えても同じ規則で並ぶ（置き方は写真の形と順番から決まる。exhibition.css）。
 * 押すといつものビューアが、表紙から数えた順で開く。
 */
export function ExhibitionWorks({
  photos,
  viewer,
  label,
  text,
  photographerName,
}: {
  /** 表紙も含めた全部の写真。 */
  photos: ExhibitionItem[];
  viewer: PhotoViewerState;
  /** 読み上げ用の一覧の名前。 */
  label: string;
  /** 添える文。書くまで出さない。 */
  text: string;
  photographerName?: string;
}) {
  const fadeRef = useScrollFadeIn([photos.length]);
  return (
    <section className="ex-works" aria-label={label} ref={fadeRef}>
      <ol className="ex-works__list">
        {photos.slice(1).map((photo, i) => {
          const size = orientedDimensions(photo.width, photo.height, (photo as GalleryPhoto).rotationDeg);
          return (
            <li
              key={photo.id}
              className="ex-work"
              data-shape={exhibitionShape(size.width, size.height)}
              data-side={i % 2 === 0 ? "right" : "left"}
            >
              <button
                type="button"
                className="ex-work__open fade-in-item"
                data-photo-tile={photo.id}
                onClick={() => viewer.open(i + 1)}
                style={
                  size.width && size.height
                    ? ({ "--ex-ar": String(size.width / size.height) } as React.CSSProperties)
                    : undefined
                }
              >
                <Picture
                  url={photo.url}
                  thumbUrl={(photo as GalleryPhoto).thumbUrl}
                  mediumUrl={(photo as GalleryPhoto).mediumUrl}
                  width={photo.width}
                  height={photo.height}
                  rotationDeg={(photo as GalleryPhoto).rotationDeg}
                  alt={photoAltText(photo, { photographerName })}
                  preset="grid"
                  sizes="(min-width: 768px) 60vw, 100vw"
                  fallbackW={1200}
                  fallbackQ={84}
                  className="ex-work__img"
                  loading="lazy"
                  draggable={false}
                />
              </button>
              {photo.title && <p className="ex-work__title">{photo.title}</p>}
            </li>
          );
        })}
      </ol>
      {text && (
        <p className="ex-works__text">
          <JaPhrases>{text}</JaPhrases>
        </p>
      )}
    </section>
  );
}
