import { useState } from "react";
import { HeroPicture } from "../HeroPicture";
import type { GalleryPhoto } from "../PhotoGallery";
import { photoAltText } from "../../../shared/photo-alt";
import { PhotoAppIcon as Icon } from "./PhotoAppIcons";

export function PhotoAppCover({ photos, name, subtitle, onOpen }: {
  photos: GalleryPhoto[];
  name: string;
  subtitle: string;
  onOpen: (photo: GalleryPhoto, button: HTMLButtonElement) => void;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<number | null>(null);
  const index = Math.min(active, photos.length - 1);
  const photo = photos[index];
  if (!photo) return null;
  return (
    <section className="pa-cover" aria-label="代表作品">
      <button className="pa-cover-photo" onClick={(event) => onOpen(photo, event.currentTarget)} aria-label="代表作品を拡大">
        {failed === photo.id ? (
          <img src={photo.thumbUrl || photo.url} alt={photoAltText(photo)} />
        ) : (
          <HeroPicture key={photo.id} {...photo} alt={photoAltText(photo)} sizes="100vw" loading="eager" fetchPriority="high" decoding="async" onError={() => setFailed(photo.id)} />
        )}
      </button>
      <div className="pa-cover-caption">
        <h1>{name}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {photos.length > 1 && (
        <div className="pa-cover-paging pa-glass pa-glass-dark">
          <button className="pa-icon" aria-label="前の代表作品" onClick={() => setActive((index + photos.length - 1) % photos.length)}><Icon name="left" /></button>
          <output>{String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</output>
          <button className="pa-icon" aria-label="次の代表作品" onClick={() => setActive((index + 1) % photos.length)}><Icon name="right" /></button>
        </div>
      )}
    </section>
  );
}
