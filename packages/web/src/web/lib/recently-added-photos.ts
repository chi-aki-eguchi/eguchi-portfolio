export type RecentlyAddedPhoto = {
  id: number;
};

export type RecentlyAddedPhotoSections<T extends RecentlyAddedPhoto> = {
  recentlyAddedPhotos: T[];
  regularPhotos: readonly T[];
};

export function splitRecentlyAddedPhotos<T extends RecentlyAddedPhoto>({
  allPhotos,
  displayedPhotos,
  recentlyAddedPhotoIds,
  enabled,
}: {
  // The caller supplies all photos in the current view-sort order. Photos
  // outside the active filters can then follow that same deterministic order.
  allPhotos: readonly T[];
  displayedPhotos: readonly T[];
  recentlyAddedPhotoIds: ReadonlySet<number>;
  enabled: boolean;
}): RecentlyAddedPhotoSections<T> {
  if (!enabled || recentlyAddedPhotoIds.size === 0) {
    return {
      recentlyAddedPhotos: [],
      regularPhotos: displayedPhotos,
    };
  }

  const allPhotosById = new Map(allPhotos.map((photo) => [photo.id, photo]));
  const includedIds = new Set<number>();
  const recentlyAddedPhotos: T[] = [];

  // Photos that pass the filters keep their position in the sorted result.
  for (const displayedPhoto of displayedPhotos) {
    if (
      !recentlyAddedPhotoIds.has(displayedPhoto.id) ||
      includedIds.has(displayedPhoto.id)
    ) {
      continue;
    }
    const photo = allPhotosById.get(displayedPhoto.id);
    if (!photo) continue;
    includedIds.add(photo.id);
    recentlyAddedPhotos.push(photo);
  }

  // Recently added photos outside the filters remain reachable. They come
  // after the in-filter photos and follow the same view-sort order supplied
  // through allPhotos.
  for (const photo of allPhotos) {
    if (
      !recentlyAddedPhotoIds.has(photo.id) ||
      includedIds.has(photo.id)
    ) {
      continue;
    }
    includedIds.add(photo.id);
    recentlyAddedPhotos.push(photo);
  }

  if (includedIds.size === 0) {
    return {
      recentlyAddedPhotos,
      regularPhotos: displayedPhotos,
    };
  }

  return {
    recentlyAddedPhotos,
    regularPhotos: displayedPhotos.filter(
      (photo) => !includedIds.has(photo.id),
    ),
  };
}
