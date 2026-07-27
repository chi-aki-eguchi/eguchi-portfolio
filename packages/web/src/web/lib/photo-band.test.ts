import { describe, expect, test } from "bun:test";
import {
  BAND_GAP_HOURS,
  BAND_MIN_PHOTOS,
  buildPhotoBands,
} from "./photo-band";

type TestPhoto = {
  id: number;
  shotAt: string | null;
  createdAt?: string | null;
};

const BASE_TIME = Date.parse("2030-01-10T00:00:00.000Z");

function at(hours: number, minutes = 0): string {
  return new Date(BASE_TIME + (hours * 60 + minutes) * 60 * 1000).toISOString();
}

function photo(id: number, hours: number, minutes = 0): TestPhoto {
  return { id, shotAt: at(hours, minutes) };
}

describe("buildPhotoBands", () => {
  test("five photos connected by gaps within 12 hours become one sheet", () => {
    const photos = [photo(1, 0), photo(2, 2), photo(3, 5), photo(4, 9), photo(5, 20)];
    const result = buildPhotoBands(photos);

    expect(BAND_GAP_HOURS).toBe(12);
    expect(BAND_MIN_PHOTOS).toBe(5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "sheet",
      source: "auto",
      firstPhoto: photos[0],
      photoCount: 5,
      startAt: at(0),
      endAt: at(20),
    });
    expect(result[0]?.photos.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5]);
  });

  test("a four-photo candidate remains a flow", () => {
    const result = buildPhotoBands([
      photo(1, 0),
      photo(2, 1),
      photo(3, 2),
      photo(4, 3),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "flow",
      source: "auto",
      photoCount: 4,
    });
  });

  test("exactly 12 hours stays together and 12 hours 1 minute starts a new candidate", () => {
    const result = buildPhotoBands([
      photo(1, 0),
      photo(2, 12),
      photo(3, 24, 1),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(({ photoCount }) => photoCount)).toEqual([2, 1]);
    expect(result[0]?.photos.map(({ id }) => id)).toEqual([1, 2]);
    expect(result[1]?.photos.map(({ id }) => id)).toEqual([3]);
  });

  test("crossing midnight does not split a closely timed candidate", () => {
    const result = buildPhotoBands([
      photo(1, 23, 58),
      photo(2, 24, 1),
      photo(3, 24, 2),
      photo(4, 24, 3),
      photo(5, 24, 4),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("sheet");
    expect(result[0]?.startAt).toBe(at(23, 58));
    expect(result[0]?.endAt).toBe(at(24, 4));
  });

  test("photos with the same timestamp stay in one deterministic sheet", () => {
    const sameTime = at(4);
    const result = buildPhotoBands(
      [5, 1, 4, 2, 3].map((id) => ({ id, shotAt: sameTime })),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("sheet");
    expect(result[0]?.photos.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5]);
    expect(result[0]?.startAt).toBe(sameTime);
    expect(result[0]?.endAt).toBe(sameTime);
  });

  test("ascending and descending input produce the same result", () => {
    const ascending = [
      photo(1, 0),
      photo(2, 1),
      photo(3, 2),
      photo(4, 20),
      photo(5, 21),
    ];
    const descending = [...ascending].reverse();

    expect(buildPhotoBands(descending)).toEqual(buildPhotoBands(ascending));
  });

  test("missing shotAt falls back to createdAt and fully undated photos stay separate", () => {
    const result = buildPhotoBands([
      photo(1, 0),
      { id: 2, shotAt: null, createdAt: at(1) },
      { id: 3, shotAt: "not-a-date", createdAt: at(2) },
      photo(4, 3),
      photo(5, 4),
      { id: 99, shotAt: null, createdAt: null },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.kind).toBe("sheet");
    expect(result[0]?.photos.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5]);
    expect(result[1]).toMatchObject({
      kind: "flow",
      firstPhoto: { id: 99 },
      photoCount: 1,
      startAt: null,
      endAt: null,
    });
  });

  test("empty and one-photo input return the expected minimal results", () => {
    expect(buildPhotoBands([])).toEqual([]);

    const single = photo(1, 0);
    expect(buildPhotoBands([single])).toEqual([
      expect.objectContaining({
        kind: "flow",
        firstPhoto: single,
        photoCount: 1,
        startAt: at(0),
        endAt: at(0),
      }),
    ]);
  });

  test("the same sheet membership always produces the same automatic ID", () => {
    const photos = [photo(1, 0), photo(2, 1), photo(3, 2), photo(4, 3), photo(5, 4)];
    const firstId = buildPhotoBands(photos)[0]?.id;
    const secondId = buildPhotoBands([...photos].reverse())[0]?.id;

    expect(firstId).toMatch(/^auto-sheet:/);
    expect(secondId).toBe(firstId);
  });

  test("a chain of gaps that each stay under the limit becomes one long sheet", () => {
    // 既知の性質。区切りは隣り合う2枚の間隔だけで決まるので、11時間おきに
    // 撮り続けた30枚は、全体が約2週間でも1つのシートになる。
    const eleven = 11 * 60;
    const chained = Array.from({ length: 30 }, (_, index) =>
      photo(index + 1, 0, index * eleven),
    );
    const result = buildPhotoBands(chained);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "sheet", photoCount: 30 });
    expect(result[0]?.startAt).toBe(at(0));
    expect(result[0]?.endAt).toBe(at(0, 29 * eleven));
  });

  test("the pure calculation does not mutate its input array", () => {
    const photos = [photo(3, 3), photo(1, 1), photo(2, 2)];
    const originalOrder = photos.map(({ id }) => id);

    buildPhotoBands(photos);

    expect(photos.map(({ id }) => id)).toEqual(originalOrder);
  });
});
