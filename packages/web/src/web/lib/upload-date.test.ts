import { describe, expect, test } from "bun:test";
import {
  shotAtForDateInputSave,
  shotAtForUploadedPhoto,
  shotAtWithSourceForUploadedPhoto,
} from "./upload-date";

describe("shotAtWithSourceForUploadedPhoto", () => {
  const lastModified = Date.UTC(2026, 5, 30, 1, 2, 3);

  test("digital uploads return the EXIF shot date and exif_original", () => {
    expect(
      shotAtWithSourceForUploadedPhoto(
        "2026-06-29T10:11:12",
        null,
        { lastModified },
        "digital",
      ),
    ).toEqual({
      shotAt: "2026-06-29T10:11:12",
      shotAtSource: "exif_original",
    });
  });

  test("digital uploads without an EXIF shot date return an empty date and none", () => {
    expect(
      shotAtWithSourceForUploadedPhoto(
        null,
        null,
        { lastModified },
        "digital",
      ),
    ).toEqual({ shotAt: "", shotAtSource: "none" });
  });

  test("film uploads return DateTimeDigitized and exif_digitized", () => {
    expect(
      shotAtWithSourceForUploadedPhoto(
        "2026-06-29T10:11:12",
        "2026-07-01T09:00:00",
        { lastModified },
        "film",
      ),
    ).toEqual({
      shotAt: "2026-07-01T09:00:00",
      shotAtSource: "exif_digitized",
    });
  });

  test("film uploads without DateTimeDigitized return the file date and file_modified", () => {
    expect(
      shotAtWithSourceForUploadedPhoto(
        "2026-06-29T10:11:12",
        null,
        { lastModified },
        "film",
      ),
    ).toEqual({
      shotAt: "2026-06-30T01:02:03",
      shotAtSource: "file_modified",
    });
  });

  test("film keeps the current-time fallback classified as file_modified when lastModified is unusable", () => {
    expect(
      shotAtWithSourceForUploadedPhoto(
        null,
        undefined,
        { lastModified: Number.NaN },
        "film",
        Date.UTC(2026, 6, 2, 3, 4, 5),
      ),
    ).toEqual({
      shotAt: "2026-07-02T03:04:05",
      shotAtSource: "file_modified",
    });
  });

  test("never returns legacy for valid, broken, empty, null, or undefined EXIF inputs", () => {
    const exifInputs: unknown[] = [
      "2026-06-29T10:11:12",
      { broken: true },
      "",
      null,
      undefined,
    ];

    for (const exifInput of exifInputs) {
      for (const uploadMedium of ["digital", "film"] as const) {
        const result = shotAtWithSourceForUploadedPhoto(
          exifInput,
          exifInput,
          { lastModified },
          uploadMedium,
        );
        expect(result.shotAtSource).not.toBe("legacy");
      }
    }
  });
});

describe("shotAtForUploadedPhoto", () => {
  test("film uploads prefer DateTimeDigitized over DateTimeOriginal — a scanner can't know the real shot date", () => {
    expect(
      shotAtForUploadedPhoto(
        "2026-06-29T10:11:12", // DateTimeOriginal ?? Image.DateTime — untrusted for film
        "2026-07-01T09:00:00", // DateTimeDigitized — the scan/dupe moment
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "film",
      ),
    ).toBe("2026-07-01T09:00:00");
  });

  test("falls back to the file modified date for film uploads without DateTimeDigitized", () => {
    expect(
      shotAtForUploadedPhoto(
        "2026-06-29T10:11:12",
        null,
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "film",
      ),
    ).toBe("2026-06-30T01:02:03");
  });

  test("keeps EXIF date for digital uploads", () => {
    expect(
      shotAtForUploadedPhoto(
        "2026-06-29T10:11:12",
        null,
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "digital",
      ),
    ).toBe("2026-06-29T10:11:12");
  });

  test("leaves digital uploads undated when EXIF date is missing", () => {
    expect(
      shotAtForUploadedPhoto(
        null,
        null,
        { lastModified: Date.UTC(2026, 5, 30, 1, 2, 3) },
        "digital",
      ),
    ).toBe("");
  });
});

describe("shotAtForDateInputSave", () => {
  test("keeps the original timestamp when the date field is unchanged", () => {
    expect(shotAtForDateInputSave("2026-06-30T01:02:03", "2026-06-30")).toBe(
      "2026-06-30T01:02:03",
    );
  });

  test("persists a manually changed film photo date", () => {
    expect(shotAtForDateInputSave("2026-06-30T01:02:03", "2026-07-01")).toBe(
      "2026-07-01",
    );
  });

  test("clears the stored date when the date field is emptied", () => {
    expect(shotAtForDateInputSave("2026-06-30T01:02:03", "")).toBe("");
  });
});
