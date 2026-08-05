export type BatchPhotoMetadataPatch = {
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
};

const metadataKeys = ["camera", "lens", "filmType"] as const;

export function buildBatchPhotoMetadataPatch(
  value: unknown,
): BatchPhotoMetadataPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const patch: BatchPhotoMetadataPatch = {};
  const values = value as Record<string, unknown>;
  for (const key of metadataKeys) {
    const field = values[key];
    if (field === undefined || field === "") continue;
    if (typeof field !== "string") return null;
    patch[key] = field.trim() ? field : null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
