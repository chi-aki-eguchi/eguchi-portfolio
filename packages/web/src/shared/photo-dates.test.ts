import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  comparePhotoDates,
  normalizePhotoDate,
  readPhotoDates,
} from "./photo-dates";

import { dateTiff as tiff } from "../test-fixtures/date-tiff";

describe("source photo dates", () => {
  test.each([false, true])(
    "reads TIFF camera scan dates without sharp EXIF, endian=%s",
    async (bigEndian) => {
      const input = tiff(
        "2024:03:02 12:34:56",
        "2025:05:01 01:02:03",
        undefined,
        bigEndian,
      );
      expect((await sharp(input).metadata()).exif).toBeUndefined();
      expect(await readPhotoDates(input)).toEqual({
        original: "2024-03-02T12:34:56",
        digitized: "2025-05-01T01:02:03",
      });
    },
  );
  test("reads TIFF XMP capture time and does not substitute MetadataDate", async () => {
    const packet = (attrs: string) =>
      `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" ${attrs}/></rdf:RDF></x:xmpmeta>`;
    expect(
      await readPhotoDates(
        tiff(
          undefined,
          undefined,
          packet('exif:DateTimeOriginal="2024-03-02T12:34:56+09:00"'),
        ),
      ),
    ).toEqual({ original: "2024-03-02T12:34:56", digitized: null });
    expect(
      await readPhotoDates(
        tiff(
          undefined,
          undefined,
          packet('xmp:MetadataDate="2026-02-06T23:30:19+09:00"'),
        ),
      ),
    ).toEqual({ original: null, digitized: null });
  });
  test("reads camera JPEG dates too", async () => {
    const jpeg = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    })
      .withExif({ IFD2: { DateTimeOriginal: "2024:03:02 12:34:56" } })
      .jpeg()
      .toBuffer();
    expect((await readPhotoDates(jpeg)).original).toBe("2024-03-02T12:34:56");
  });
  test("validates dates and preserves camera wall clock", () => {
    expect(normalizePhotoDate("2024-02-29T12:34:56+09:00")).toBe(
      "2024-02-29T12:34:56",
    );
    for (const value of [
      "2023-02-29T12:34:56",
      "2024-01-01T24:00:00",
      "broken",
      null,
    ])
      expect(normalizePhotoDate(value)).toBeNull();
  });
  test.each(["asc", "desc"] as const)(
    "undated photos remain last: %s",
    (direction) => {
      const dates = [null, "invalid", "2024-01-02", "2024-01-01", ""];
      expect(
        dates.sort((a, b) => comparePhotoDates(a, b, direction)).slice(2),
      ).toEqual([null, "invalid", ""]);
    },
  );
});
