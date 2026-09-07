import type { Photo } from "../pages/admin-shared";

export type HeroCandidateSort = "manual" | "newest" | "oldest" | "shot" | "name";
export type HeroCandidateFilters = {
  search: string; category: string; orientation: string; selectedOnly: boolean;
  sort: HeroCandidateSort;
};

const timestamp = (value: Photo["createdAt"]) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Candidate order is a view preference. Never modifies the saved HERO order. */
export function heroCandidates(photos: readonly Photo[], selected: ReadonlySet<number>, filters: HeroCandidateFilters): Photo[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return photos.filter(photo => {
    if (filters.selectedOnly && !selected.has(photo.id)) return false;
    if (filters.category && photo.category !== filters.category) return false;
    if (query && ![photo.title, photo.filename, photo.camera, photo.lens, photo.filmType].some(value => value?.toLocaleLowerCase().includes(query))) return false;
    if (filters.orientation) {
      let width = photo.width ?? 0;
      let height = photo.height ?? 0;
      if (Math.abs((photo.rotationDeg ?? 0) % 180) === 90) [width, height] = [height, width];
      if (!width || !height) return false;
      if (filters.orientation === "landscape" && width <= height) return false;
      if (filters.orientation === "portrait" && height <= width) return false;
      if (filters.orientation === "square" && width !== height) return false;
    }
    return true;
  }).sort((a, b) => {
    let result = 0;
    if (filters.sort === "newest") result = timestamp(b.createdAt) - timestamp(a.createdAt);
    if (filters.sort === "oldest") result = (timestamp(a.createdAt) || Infinity) - (timestamp(b.createdAt) || Infinity);
    if (filters.sort === "shot") result = timestamp(b.shotAt) - timestamp(a.shotAt);
    if (filters.sort === "name") result = (a.title || a.filename).localeCompare(b.title || b.filename, "ja", { numeric: true });
    return result || (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id - b.id;
  });
}
