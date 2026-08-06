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

  // 型違いが1つでもあれば payload 全体を拒否する。有効な値と混ざったときに
  // その1件だけ黙って捨てて保存すると、利用者は失敗に気づけない。
  // 2026-08-06 の追試で、この分岐だけテストが無いと分かった。
  test("rejects the whole payload when one field is malformed", () => {
    expect(
      buildBatchPhotoMetadataPatch({ camera: "Nikon F3", lens: 50 }),
    ).toBeNull();
  });
});
