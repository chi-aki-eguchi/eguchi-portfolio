import type { SeriesContent as Content } from "../../shared/series-content";
import { safeContentUrl } from "../../shared/series-content";
import type { GalleryPhoto } from "./PhotoGallery";
import { orientedDimensions, photoSrcFor, photoSrcSetFor } from "../lib/picture";
import "./series-content.css";

export function SeriesContent({ content, photos }: { content: Content; photos: GalleryPhoto[] }) {
  const byId = new Map(photos.map(p => [p.id, p]));
  return <div className="project-content">
    {content.blocks.map(block => {
      if (block.type === "text") return (block.heading.trim() || block.text.trim()) && <section key={block.id} className="project-content__text">
        {block.heading && <h2>{block.heading}</h2>}
        {block.text && <p>{block.text}</p>}
      </section>;
      if (block.type === "image") {
        const photo = block.photoId ? byId.get(block.photoId) : undefined;
        if (!photo) return null;
        const dimensions = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
        return <figure key={block.id} className="project-content__image">
          <img src={photoSrcFor(photo, 1440, 85, "webp")} srcSet={photoSrcSetFor(photo, "lightbox", "webp")} sizes="(max-width: 768px) calc(100vw - 48px), 960px" width={dimensions?.width ?? undefined} height={dimensions?.height ?? undefined} alt={photo.title || block.caption || ""} loading="lazy" decoding="async" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>;
      }
      if (block.type === "link") {
        const href = safeContentUrl(block.url);
        if (!href) return null;
        return <section key={block.id} className="project-content__link">
          <a href={href} target="_blank" rel="noopener noreferrer">{block.label || new URL(href).hostname}<span aria-hidden="true"> ↗</span></a>
          {block.description && <p>{block.description}</p>}
        </section>;
      }
      const rows = block.items.filter(i => i.label.trim() && i.value.trim());
      return rows.length > 0 && <dl key={block.id} className="project-content__facts">{rows.map((item, i) => <div key={i}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
    })}
  </div>;
}
