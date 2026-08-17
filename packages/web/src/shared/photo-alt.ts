// Meaningful alt/aria-label text for photos without an admin-set title. A raw
// filename or a generic "Photograph N" placeholder is useless to screen readers
// and search engines — fall back through description, then a Japanese sentence
// built from whatever context (series / category / photographer) is available.
export interface AltTextPhoto {
  title?: string | null;
  description?: string | null;
}

export interface AltTextContext {
  photographerName?: string | null;
  seriesName?: string | null;
  categoryLabel?: string | null;
}

export function photoAltText(
  photo: AltTextPhoto,
  ctx: AltTextContext = {},
): string {
  const title = photo.title?.trim();
  if (title) return title;
  const description = photo.description?.trim();
  if (description) return description;
  const photographer = ctx.photographerName?.trim();
  const category = ctx.categoryLabel?.trim();
  const subject = category ? `${category}写真` : "写真";
  const bySomeone = photographer ? `${photographer}撮影の${subject}` : subject;
  const series = ctx.seriesName?.trim();
  return series ? `${series}シリーズより、${bySomeone}` : bySomeone;
}
