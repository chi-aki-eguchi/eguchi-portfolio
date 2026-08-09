import { shuffleWithSeed, visitShuffleSeed } from "./shuffle";

export type PhotoSortOrder =
  | "manual"
  | "date_desc"
  | "date_asc"
  | "upload_desc"
  | "random";

type SortablePhoto = {
  sortOrder?: number | null;
  shotAt?: string | null;
  createdAt?: string | null;
};

function timeValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function photoDateValue(photo: SortablePhoto): number | null {
  return timeValue(photo.shotAt) ?? timeValue(photo.createdAt);
}

function sortOrderValue(photo: SortablePhoto): number {
  return typeof photo.sortOrder === "number" ? photo.sortOrder : Number.MAX_SAFE_INTEGER;
}

export function sortPhotosBySetting<T extends SortablePhoto>(
  photos: readonly T[],
  order: string | undefined | null,
): T[] {
  // ランダムはこのタブで共有する種を使う。ページを移って戻っても同じ並びに
  // 戻り、再読み込みで新しい並びになる。毎回引き直すと、戻ったときに
  // 復元したスクロール位置へ別の写真が来てしまう。
  if (order === "random") return shuffleWithSeed(photos, visitShuffleSeed());
  const mode: PhotoSortOrder =
    order === "date_desc" || order === "date_asc" || order === "upload_desc"
      ? order
      : "manual";
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      if (mode === "date_desc" || mode === "date_asc") {
        const at = photoDateValue(a.photo);
        const bt = photoDateValue(b.photo);
        if (at !== null || bt !== null) {
          if (at === null) return 1;
          if (bt === null) return -1;
          if (at !== bt) return mode === "date_desc" ? bt - at : at - bt;
        }
      } else if (mode === "upload_desc") {
        const at = timeValue(a.photo.createdAt);
        const bt = timeValue(b.photo.createdAt);
        if (at !== null || bt !== null) {
          if (at === null) return 1;
          if (bt === null) return -1;
          if (at !== bt) return bt - at;
        }
      }
      const byManual = sortOrderValue(a.photo) - sortOrderValue(b.photo);
      return byManual || a.index - b.index;
    })
    .map(({ photo }) => photo);
}
