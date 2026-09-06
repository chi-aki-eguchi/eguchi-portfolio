import { describe, expect, test } from "bun:test";
import {
  analyticsPagePath,
  analyticsRoutePath,
  isAnalyticsDynamicPath,
  isAnalyticsPublicPath,
} from "./analytics-path";

describe("analytics route path handling", () => {
  test("normalizes query and hash in route path", () => {
    expect(analyticsRoutePath("/portfolio-kit/guide?utm=blog#top")).toBe(
      "/portfolio-kit/guide",
    );
    expect(analyticsPagePath("/photo/123?view=full")).toBe("/photo/:id");
  });

  test("keeps dynamic SPA routes in dynamic mode", () => {
    expect(isAnalyticsDynamicPath("/series/winter"))
      .toBe(true);
    expect(isAnalyticsDynamicPath("/work/studio"))
      .toBe(true);
    expect(isAnalyticsDynamicPath("/portfolio-kit/guide"))
      .toBe(false);
  });

  test("recognizes public routes with guide for analytics", () => {
    expect(isAnalyticsPublicPath("/portfolio-kit/guide")).toBe(true);
    expect(isAnalyticsPublicPath("/portfolio-kit/consult")).toBe(true);
    expect(isAnalyticsPublicPath("/admin/demo")).toBe(false);
  });
});
