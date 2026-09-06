import { describe, expect, test } from "bun:test";
import {
  isServiceVisibilityGatedPath,
  resolveServiceContactEmail,
  resolveServiceNavVisibility,
  resolveServiceVisibility,
} from "./service-visibility";

describe("isServiceVisibilityGatedPath", () => {
  test("keeps owner sales, buyer-start, and disclosure routes private when disabled", () => {
    for (const path of [
      "/portfolio-kit",
      "/portfolio-kit/guide",
      "/portfolio-kit/consult",
      "/portfolio-kit/en",
      "/portfolio-kit/start",
      "/start",
      "/start/en",
    ]) {
      expect(isServiceVisibilityGatedPath(path)).toBe(true);
    }
    expect(isServiceVisibilityGatedPath("/privacy")).toBe(false);
    expect(isServiceVisibilityGatedPath("/terms/en")).toBe(false);
  });
});

describe("resolveServiceContactEmail", () => {
  test("uses configured contact details on distributed sites", () => {
    expect(
      resolveServiceContactEmail(
        "hello@example.com",
        "https://portfolio.example",
        "portfolio.example",
      ),
    ).toBe("hello@example.com");
  });

  test("does not turn a malformed configured value into a mailto destination", () => {
    expect(
      resolveServiceContactEmail(
        "not-an-email",
        "https://portfolio.example",
        "portfolio.example",
      ),
    ).toBe("");
  });

  test("keeps the owner fallback only on akieguchi.com", () => {
    expect(resolveServiceContactEmail("", "https://akieguchi.com", "")).toBe(
      "akieguchi33@gmail.com",
    );
    expect(
      resolveServiceContactEmail("", "https://portfolio.example", "localhost"),
    ).toBe("");
  });
});

describe("resolveServiceVisibility", () => {
  test("on always shows Service", () => {
    expect(resolveServiceVisibility("on", "https://example.com", "other.test"))
      .toBe(true);
  });

  test("off always hides Service", () => {
    expect(
      resolveServiceVisibility(
        "off",
        "https://akieguchi.com",
        "akieguchi.com",
      ),
    ).toBe(false);
  });

  test("empty mode keeps the legacy siteUrl host check", () => {
    expect(
      resolveServiceVisibility("", "https://www.akieguchi.com/path", "other.test"),
    ).toBe(true);
  });

  test("empty mode falls back to the current window host", () => {
    expect(
      resolveServiceVisibility("", "https://example.com", "WWW.AKIEGUCHI.COM"),
    ).toBe(true);
  });

  test("empty mode stays off on distributed hosts", () => {
    expect(
      resolveServiceVisibility("", "https://portfolio.example", "portfolio.example"),
    ).toBe(false);
  });

  test("missing, invalid, and unknown values use the legacy fallback", () => {
    expect(resolveServiceVisibility(undefined, "not a url", "localhost")).toBe(
      false,
    );
    expect(
      resolveServiceVisibility("unexpected", undefined, "akieguchi.com"),
    ).toBe(true);
  });
});

describe("resolveServiceNavVisibility", () => {
  test("only an explicit on setting adds Portfolio Kit to navigation", () => {
    expect(resolveServiceNavVisibility("on")).toBe(true);
    expect(resolveServiceNavVisibility("")).toBe(false);
    expect(resolveServiceNavVisibility(undefined)).toBe(false);
    expect(resolveServiceNavVisibility("off")).toBe(false);
  });
});
