import { describe, expect, test } from "bun:test";
import {
  canonicalPortfolioKitPath,
  canonicalSpaRedirectUrl,
  htmlStatusForSpaPath,
  isKnownSpaPath,
  isSeriesDetailPath,
  normalizeSpaPathname,
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
      "/portfolio-kit",
      "/portfolio-kit/start",
      "/admin",
      "/admin/login",
    ]) {
      expect(isKnownSpaPath(path)).toBe(true);
      expect(htmlStatusForSpaPath(path)).toBe(200);
    }
  });

  test("maps legacy service URLs to Portfolio Kit and keeps canonical paths", () => {
    expect(canonicalPortfolioKitPath("/service")).toBe("/portfolio-kit");
    expect(canonicalPortfolioKitPath("/service/start/")).toBe(
      "/portfolio-kit/start",
    );
    expect(canonicalPortfolioKitPath("/portfolio-kit")).toBe(
      "/portfolio-kit",
    );
  });

  test("series detail routes depend on whether the slug resolves", () => {
    expect(isSeriesDetailPath("/series/ishigakiisland")).toBe(true);
    expect(htmlStatusForSpaPath("/series/ishigakiisland", { seriesFound: true })).toBe(200);
    expect(htmlStatusForSpaPath("/series/zzz-not-exist", { seriesFound: false })).toBe(404);
  });

  test("normalizes trailing slashes for shared public URLs", () => {
    expect(normalizeSpaPathname("/gallery/")).toBe("/gallery");
    expect(isKnownSpaPath("/gallery/")).toBe(true);
    expect(htmlStatusForSpaPath("/gallery/")).toBe(200);
    expect(isSeriesDetailPath("/series/ishigakiisland/")).toBe(true);
    expect(
      htmlStatusForSpaPath("/series/ishigakiisland/", { seriesFound: true }),
    ).toBe(200);
  });

  test("canonical trailing-slash redirects keep the public https origin", () => {
    expect(
      canonicalSpaRedirectUrl(
        "http://akieguchi.com/gallery/?utm_source=x",
        "https://akieguchi.com",
        "/gallery/",
      ),
    ).toBe("https://akieguchi.com/gallery?utm_source=x");
  });

  test("unknown extensionless paths still serve the SPA shell, but with 404 status", () => {
    expect(isKnownSpaPath("/unknown-test-path")).toBe(false);
    expect(htmlStatusForSpaPath("/unknown-test-path")).toBe(404);
  });
});
