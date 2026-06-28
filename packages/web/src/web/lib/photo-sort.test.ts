import { describe, expect, test } from "bun:test";
import { sortPhotosBySetting } from "./photo-sort";

const photos = [
  { id: 1, sortOrder: 2, shotAt: "2026-01-01T00:00:00", createdAt: "2026-01-03T00:00:00Z" },
  { id: 2, sortOrder: 0, shotAt: null, createdAt: "2026-01-04T00:00:00Z" },
  { id: 3, sortOrder: 1, shotAt: "2026-01-02T00:00:00", createdAt: "2026-01-02T00:00:00Z" },
];

describe("sortPhotosBySetting", () => {
  test("manual order follows sortOrder", () => {
    expect(sortPhotosBySetting(photos, "manual").map((p) => p.id)).toEqual([2, 3, 1]);
  });

  test("date sorts fall back to upload date when shotAt is missing", () => {
    expect(sortPhotosBySetting(photos, "date_desc").map((p) => p.id)).toEqual([2, 3, 1]);
    expect(sortPhotosBySetting(photos, "date_asc").map((p) => p.id)).toEqual([1, 3, 2]);
  });

  test("upload_desc sorts by createdAt and falls back safely", () => {
    expect(sortPhotosBySetting(photos, "upload_desc").map((p) => p.id)).toEqual([2, 1, 3]);
  });

  test("unknown order falls back to manual", () => {
    expect(sortPhotosBySetting(photos, "surprise").map((p) => p.id)).toEqual([2, 3, 1]);
  });
});
