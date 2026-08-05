import { describe, expect, test } from "bun:test";
import { buildBatchPhotoMetadataPatch } from "./batch-photo-metadata";

describe("buildBatchPhotoMetadataPatch", () => {
  test("combines supplied metadata fields into one patch", () => {
    expect(
      buildBatchPhotoMetadataPatch({
        camera: "Nikon F3",
        lens: "",
        filmType: "フィルム",
      }),
    ).toEqual({ camera: "Nikon F3", filmType: "フィルム" });
  });

  test("keeps the existing whitespace-clears-field behavior", () => {
    expect(buildBatchPhotoMetadataPatch({ lens: "  " })).toEqual({
      lens: null,
    });
  });

  test("rejects malformed payloads instead of silently dropping a field", () => {
    expect(buildBatchPhotoMetadataPatch(null)).toBeNull();
    expect(buildBatchPhotoMetadataPatch([])).toBeNull();
    expect(buildBatchPhotoMetadataPatch({ camera: 123 })).toBeNull();
    expect(buildBatchPhotoMetadataPatch({ camera: "" })).toBeNull();
  });
});
