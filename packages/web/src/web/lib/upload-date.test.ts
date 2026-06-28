import { describe, expect, test } from "bun:test";
import { shotAtForUploadedPhoto } from "./upload-date";

describe("shotAtForUploadedPhoto", () => {
  test("keeps EXIF date for film uploads while other EXIF fields stay optional", () => {
    expect(
      shotAtForUploadedPhoto(
        "2026-06-29T10:11:12",
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "film",
      ),
    ).toBe("2026-06-29T10:11:12");
  });

  test("falls back to the file modified date for film uploads without EXIF date", () => {
    expect(
      shotAtForUploadedPhoto(
        null,
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "film",
      ),
    ).toBe("2026-06-30T01:02:03");
  });

  test("leaves digital uploads undated when EXIF date is missing", () => {
    expect(
      shotAtForUploadedPhoto(
        null,
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "digital",
      ),
    ).toBe("");
  });
});
