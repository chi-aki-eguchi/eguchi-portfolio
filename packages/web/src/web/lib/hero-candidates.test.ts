import { describe, expect, test } from "bun:test";
import { heroCandidates, type HeroCandidateFilters } from "./hero-candidates";
import type { Photo } from "../pages/admin-shared";

const base: HeroCandidateFilters = { search: "", category: "", orientation: "", selectedOnly: false, sort: "newest" };
const photo = (id: number, values: Partial<Photo>): Photo => ({ id, url: "", title: "", filename: `photo${id}.jpg`, meta: "", description: "", category: "", ...values });
const photos = [photo(1, { createdAt: "2026-01-01", sortOrder: 2, width: 400, height: 200 }), photo(2, { createdAt: "2026-02-01", sortOrder: 1, width: 400, height: 200, rotationDeg: 90, camera: "FUJIFILM" }), photo(3, { createdAt: null, sortOrder: 0, width: 200, height: 200 })];
const ids = (filters: Partial<HeroCandidateFilters>) => heroCandidates(photos, new Set([2]), { ...base, ...filters }).map(p => p.id);
describe("HERO candidate browsing", () => {
  test("sorts dates with missing dates last without changing photo or HERO order", () => {
    expect(ids({})).toEqual([2, 1, 3]);
    expect(ids({ sort: "oldest" })).toEqual([1, 2, 3]);
    expect(ids({ sort: "manual" })).toEqual([3, 2, 1]);
    expect(photos.map(p => p.id)).toEqual([1, 2, 3]);
  });
  test("uses displayed orientation after rotation", () => {
    expect(ids({ orientation: "portrait" })).toEqual([2]);
    expect(ids({ orientation: "landscape" })).toEqual([1]);
    expect(ids({ orientation: "square" })).toEqual([3]);
  });
  test("combines selected-only with search and category", () => {
    expect(ids({ selectedOnly: true, search: " fujifilm " })).toEqual([2]);
    expect(ids({ selectedOnly: true, search: "photo1" })).toEqual([]);
    expect(ids({ category: "portrait" })).toEqual([]);
  });
  test("unknown dimensions do not pretend to match an orientation", () => {
    expect(heroCandidates([photo(4, {})], new Set(), { ...base, orientation: "square" })).toEqual([]);
  });
});
