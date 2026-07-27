import { describe, expect, test } from "bun:test";
import {
  normalizeShotAtSourceForInsert,
  normalizeSourceFormat,
  normalizeSourceFormatForInsert,
  sourceMetadataFromSharpMetadata,
} from "./source-metadata";

describe("normalizeSourceFormat", () => {
  test.each([
    ["jpeg", undefined, "jpeg"],
    ["png", undefined, "png"],
    ["webp", undefined, "webp"],
    ["tiff", undefined, "tiff"],
    ["heif", "av1", "avif"],
    ["heif", "hevc", "heic"],
    ["gif", undefined, "other"],
  ])(
    "normalizes format=%s compression=%s to %s",
    (format, compression, expected) => {
      expect(normalizeSourceFormat(format, compression)).toBe(expected);
    },
  );

  test("maps an unknown future format to other without throwing", () => {
    expect(normalizeSourceFormat("future-format", undefined)).toBe("other");
  });

  test("keeps an unknown HEIF compression in the known-but-unsupported bucket", () => {
    expect(normalizeSourceFormat("heif", "future-codec")).toBe("other");
  });

  test("returns null when the format could not be read", () => {
    expect(normalizeSourceFormat(undefined, undefined)).toBeNull();
    expect(normalizeSourceFormat(null, null)).toBeNull();
  });
});

describe("sourceMetadataFromSharpMetadata", () => {
  test("uses auto-oriented dimensions and ignores the raw dimensions", () => {
    expect(
      sourceMetadataFromSharpMetadata({
        width: 40,
        height: 24,
        autoOrient: { width: 24, height: 40 },
        format: "jpeg",
      }),
    ).toEqual({
      sourceWidth: 24,
      sourceHeight: 40,
      sourceFormat: "jpeg",
    });
  });

  test("does not fall back to raw dimensions when autoOrient is unavailable", () => {
    expect(
      sourceMetadataFromSharpMetadata({
        width: 40,
        height: 24,
        format: "jpeg",
      }),
    ).toEqual({
      sourceWidth: null,
      sourceHeight: null,
      sourceFormat: "jpeg",
    });
  });

  test("returns null fields when metadata reading failed", () => {
    expect(sourceMetadataFromSharpMetadata(null)).toEqual({
      sourceWidth: null,
      sourceHeight: null,
      sourceFormat: null,
    });
  });
});

describe("normalizeShotAtSourceForInsert", () => {
  test.each([
    "exif_original",
    "exif_digitized",
    "file_modified",
    "manual",
    "none",
  ])("accepts %s", (value) => {
    expect(normalizeShotAtSourceForInsert(value)).toBe(value);
  });

  test("turns legacy and every invalid value into none", () => {
    for (const value of ["legacy", "unexpected", "", null, undefined, 123]) {
      expect(normalizeShotAtSourceForInsert(value)).toBe("none");
    }
  });
});

describe("normalizeSourceFormatForInsert", () => {
  test.each(["jpeg", "png", "webp", "tiff", "avif", "heic", "other"])(
    "accepts the closed-set value %s",
    (value) => {
      expect(normalizeSourceFormatForInsert(value)).toBe(value);
    },
  );

  test("turns every non-empty string outside the closed set into other", () => {
    for (const value of ["gif", "JPEG", "future-format", " "]) {
      expect(normalizeSourceFormatForInsert(value)).toBe("other");
    }
  });

  test("turns empty and non-string values into null", () => {
    for (const value of ["", null, undefined, 123, {}]) {
      expect(normalizeSourceFormatForInsert(value)).toBeNull();
    }
  });
});
