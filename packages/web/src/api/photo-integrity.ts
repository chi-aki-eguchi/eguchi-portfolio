export type PurgeCandidate = {
  url: string;
  thumbKey: string | null;
  mediumKey: string | null;
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

export function unsharedPhotoStorageKeys(
  photo: Pick<PurgeCandidate, "url" | "thumbKey" | "mediumKey">,
  hasSharer: boolean,
): string[] {
  if (hasSharer) return [];
  return [
    photo.url.replace("/api/images/", ""),
    photo.thumbKey,
    photo.mediumKey,
  ].filter((key): key is string => !!key);
}

export function uploadedPhotoStorageKeys(body: Record<string, unknown>): string[] {
  const keys = [
    typeof body.url === "string" ? body.url.replace("/api/images/", "") : null,
    typeof body.thumbKey === "string" ? body.thumbKey : null,
    typeof body.mediumKey === "string" ? body.mediumKey : null,
  ].filter((key): key is string => !!key && key.startsWith("photos/"));
  return [...new Set(keys)];
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
