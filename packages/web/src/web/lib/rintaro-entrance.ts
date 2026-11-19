import { isServiceOwnerSite } from "../../shared/service-visibility";
import type { GalleryPhoto } from "../components/PhotoGallery";

export function isRintaroEntrance(slug: string, siteUrl?: string) {
  const host = typeof window === "undefined" ? undefined : window.location.hostname;
  return slug === "rintaro" && isServiceOwnerSite(siteUrl, host);
}

type WorkCover = {
  id: number;
  slug: string;
  coverPhotoId?: number | null;
  coverUrl?: string | null;
  coverWidth?: number | null;
  coverHeight?: number | null;
  coverRotationDeg?: number | null;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
};

// 江口さんの編集（2026-11-19）。旧表紙の間だけ入口を差し替える。
// 管理画面で新しい表紙を選ぶか解除すれば、以後はその設定を使う。
export function entranceCover<T extends WorkCover>(work: T, photos: readonly GalleryPhoto[], siteUrl?: string): T {
  if (!isRintaroEntrance(work.slug, siteUrl) || work.coverPhotoId !== 2187) return work;
  const chosen = photos.find((photo) =>
    photo.id === 2134 && (photo.seriesId === work.id || photo.seriesIds?.includes(work.id)),
  );
  if (!chosen) return work;
  return {
    ...work,
    coverPhotoId: chosen.id,
    coverUrl: chosen.url,
    coverWidth: chosen.width,
    coverHeight: chosen.height,
    coverRotationDeg: chosen.rotationDeg,
    coverFocalX: chosen.focalX,
    coverFocalY: chosen.focalY,
  };
}
