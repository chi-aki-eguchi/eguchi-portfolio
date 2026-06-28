import { describe, expect, test } from "bun:test";
import {
  htmlStatusForSpaPath,
  isKnownSpaPath,
  isSeriesDetailPath,
} from "./public-routes";

describe("public SPA route status", () => {
  test("keeps known app routes as normal 200 HTML responses", () => {
    for (const path of [
      "/",
      "/gallery",
      "/series",
      "/about",
      "/profile",
      "/contact",
      "/service",
      "/admin",
      "/admin/login",
    ]) {
      expect(isKnownSpaPath(path)).toBe(true);
      expect(htmlStatusForSpaPath(path)).toBe(200);
    }
  });

  test("series detail routes depend on whether the slug resolves", () => {
    expect(isSeriesDetailPath("/series/ishigakiisland")).toBe(true);
    expect(htmlStatusForSpaPath("/series/ishigakiisland", { seriesFound: true })).toBe(200);
    expect(htmlStatusForSpaPath("/series/zzz-not-exist", { seriesFound: false })).toBe(404);
  });

  test("unknown extensionless paths still serve the SPA shell, but with 404 status", () => {
    expect(isKnownSpaPath("/unknown-test-path")).toBe(false);
    expect(htmlStatusForSpaPath("/unknown-test-path")).toBe(404);
  });
});
