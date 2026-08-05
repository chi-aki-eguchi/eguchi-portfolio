import { describe, expect, test } from "bun:test";
import { uniqueUploadStorageKey } from "./upload-key";

describe("uniqueUploadStorageKey", () => {
  test("keeps concurrent uploads with the same name in distinct storage objects", () => {
    const first = uniqueUploadStorageKey(
      "photos",
      "IMG_0001.jpg",
      1_700_000_000_000,
      "first",
    );
    const second = uniqueUploadStorageKey(
      "photos",
      "IMG_0001.jpg",
      1_700_000_000_000,
      "second",
    );

    expect(first).toBe("photos/1700000000000-first-IMG_0001.jpg");
    expect(second).toBe("photos/1700000000000-second-IMG_0001.jpg");
    expect(first).not.toBe(second);
  });
});
