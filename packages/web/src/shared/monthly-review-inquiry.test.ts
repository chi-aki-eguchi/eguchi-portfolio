import { describe, expect, test } from "bun:test";
import { monthlyReviewRequested, monthlyReviewSubject } from "./monthly-review-inquiry";

describe("monthly review consultation context", () => {
  test("recognizes only the fixed inquiry on the owner's site", () => {
    expect(monthlyReviewRequested("?inquiry=monthly-review", true)).toBe(true);
    expect(monthlyReviewRequested("inquiry=monthly-review", true)).toBe(true);
    expect(monthlyReviewRequested("?inquiry=monthly-review&work=public-work", true)).toBe(true);
  });
  test("does not enable a service on a buyer's site", () => {
    expect(monthlyReviewRequested("?inquiry=monthly-review", false)).toBe(false);
  });
  test("leaves ordinary photography and unknown queries alone", () => {
    for (const search of ["", "?work=public-work", "?inquiry=Shooting", "?inquiry=monthly-review-other", "?subject=月々点検について"]) {
      expect(monthlyReviewRequested(search, true)).toBe(false);
    }
  });
  test("uses readable subjects in both supported contact languages", () => {
    expect(monthlyReviewSubject("ja")).toBe("月々点検について");
    expect(monthlyReviewSubject("en")).toBe("Monthly site review");
  });
});
