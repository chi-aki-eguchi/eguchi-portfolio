import { describe, expect, test } from "bun:test";
import {
  shotAtForDateInputSave,
  shotAtForUploadedPhoto,
} from "./upload-date";

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

describe("shotAtForDateInputSave", () => {
  test("keeps the original timestamp when the date field is unchanged", () => {
    expect(
      shotAtForDateInputSave("2026-06-30T01:02:03", "2026-06-30"),
    ).toBe("2026-06-30T01:02:03");
  });

  test("persists a manually changed film photo date", () => {
    expect(
      shotAtForDateInputSave("2026-06-30T01:02:03", "2026-07-01"),
    ).toBe("2026-07-01");
  });

  test("clears the stored date when the date field is emptied", () => {
    expect(shotAtForDateInputSave("2026-06-30T01:02:03", "")).toBe("");
  });
});
