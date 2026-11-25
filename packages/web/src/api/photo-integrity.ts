import { parseZoomSize, zoomBaseKey, zoomTilePaths } from "../shared/photo-zoom";

export type PurgeCandidate = {
  url: string;
  thumbKey: string | null;
  mediumKey: string | null;
  zoomSize?: string | null;
  deletedAt: Date | null;
};

export type PurgeEligibility = "eligible" | "not-trashed" | "restored";

export function purgeEligibility(
  photo: Pick<PurgeCandidate, "deletedAt">,
  expiredBefore?: Date,
): PurgeEligibility {
  if (photo.deletedAt === null) return expiredBefore ? "restored" : "not-trashed";
  if (expiredBefore && photo.deletedAt >= expiredBefore) return "restored";
  return "eligible";
}

/**
 * 拡大用の高精細（四角に切ったもの）の鍵。保存する1枚の鍵と大きさから一意に決まる。
 * 大きさが無い・読めない写真は高精細を持たないので、空。
 */
export function zoomStorageKeys(photoKey: string, zoomSize: unknown): string[] {
  const size = parseZoomSize(zoomSize);
  const base = zoomBaseKey(photoKey);
  if (!size || !base) return [];
  return zoomTilePaths(size).map((rel) => `${base}/${rel}`);
}

export function unsharedPhotoStorageKeys(
  photo: Pick<PurgeCandidate, "url" | "thumbKey" | "mediumKey" | "zoomSize">,
  hasSharer: boolean,
): string[] {
  if (hasSharer) return [];
  const photoKey = photo.url.replace("/api/images/", "");
  return [
    photoKey,
    photo.thumbKey,
    photo.mediumKey,
    ...zoomStorageKeys(photoKey, photo.zoomSize),
  ].filter((key): key is string => !!key);
}

/** Keys this upload just created, for the compensating delete when the
 *  registration that follows it fails.
 *
 *  The old filter kept only keys under `photos/`, which is where the master
 *  lives — but the thumbnail and medium versions are written to `thumbs/` and
 *  `medium/` (see thumbKeyFrom / mediumKeyFrom in api/index.ts). So a failed or
 *  duplicate registration deleted the master and orphaned both derived images
 *  in storage, invisibly, on every occurrence.
 *
 *  That filter was also a safety guard: the body is client-supplied, so it must
 *  not be able to name somebody else's object. Rather than widen it to three
 *  prefixes, derive the only two keys this master can legitimately have and
 *  accept nothing else. That is strictly tighter than the original while
 *  covering all three objects. */
export function uploadedPhotoStorageKeys(body: Record<string, unknown>): string[] {
  const url =
    typeof body.url === "string" ? body.url.replace("/api/images/", "") : "";
  if (!url.startsWith("photos/")) return [];
  const stem = url.replace(/^photos\//, "").replace(/\.[^.]+$/, "");
  const permitted = new Set([url, `thumbs/${stem}.webp`, `medium/${stem}.webp`]);
  const keys = [
    url,
    typeof body.thumbKey === "string" ? body.thumbKey : null,
    typeof body.mediumKey === "string" ? body.mediumKey : null,
  ].filter((key): key is string => !!key && permitted.has(key));
  // 高精細の鍵は本文から受け取らず、保存する1枚の鍵から決まるものだけを数える。
  return [...new Set([...keys, ...zoomStorageKeys(url, body.zoomSize)])];
}

export async function withUploadRegistrationCompensation<T>(
  keys: readonly string[],
  register: () => Promise<T>,
  cleanup: (keys: readonly string[]) => Promise<void>,
): Promise<T> {
  try {
    return await register();
  } catch (error) {
    await cleanup(keys);
    throw error;
  }
}

export async function purgeDbThenStorage<T extends { storageKeys: string[] }>(
  purgeDb: () => Promise<T>,
  cleanup: (keys: readonly string[]) => Promise<void>,
): Promise<T> {
  const result = await purgeDb();
  await cleanup(result.storageKeys);
  return result;
}
