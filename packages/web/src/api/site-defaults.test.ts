import { afterEach, describe, expect, test } from "bun:test";
import {
  displayNameEnFrom,
  gaMeasurementIdForSite,
  isAllowedOrigin,
  siteDescriptionFrom,
} from "./site-defaults";

const envSnapshot = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  DEFAULT_SITE_URL: process.env.DEFAULT_SITE_URL,
  GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
  SITE_URL: process.env.SITE_URL,
};

afterEach(() => {
  if (envSnapshot.ALLOWED_ORIGINS === undefined)
    delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = envSnapshot.ALLOWED_ORIGINS;

  if (envSnapshot.DEFAULT_SITE_URL === undefined)
    delete process.env.DEFAULT_SITE_URL;
  else process.env.DEFAULT_SITE_URL = envSnapshot.DEFAULT_SITE_URL;

  if (envSnapshot.GA_MEASUREMENT_ID === undefined)
    delete process.env.GA_MEASUREMENT_ID;
  else process.env.GA_MEASUREMENT_ID = envSnapshot.GA_MEASUREMENT_ID;

  if (envSnapshot.SITE_URL === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = envSnapshot.SITE_URL;
});

describe("isAllowedOrigin", () => {
  test("always allows localhost development origins", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4200")).toBe(true);
  });

  test("allows configured site origins but not the generic fallback URL", () => {
    delete process.env.SITE_URL;
    delete process.env.DEFAULT_SITE_URL;
    delete process.env.ALLOWED_ORIGINS;
    expect(isAllowedOrigin("https://example.com")).toBe(false);

    process.env.SITE_URL = "https://portfolio.example";
    expect(isAllowedOrigin("https://portfolio.example")).toBe(true);
    expect(isAllowedOrigin("https://www.portfolio.example")).toBe(true);
  });

  test("allows configured extra origins and rejects arbitrary origins", () => {
    process.env.ALLOWED_ORIGINS =
      "https://client.example, https://preview.example/";
    expect(isAllowedOrigin("https://client.example")).toBe(true);
    expect(isAllowedOrigin("https://preview.example")).toBe(true);
    expect(isAllowedOrigin("https://attacker.example")).toBe(false);
  });
});

describe("derived site defaults", () => {
  test("uses an existing site name instead of leaking the generic template label", () => {
    expect(displayNameEnFrom({ siteName: "江口 秋" })).toBe("江口 秋");
    expect(siteDescriptionFrom({ siteName: "江口 秋" })).toBe(
      "江口 秋の写真ポートフォリオ。",
    );
  });
});

describe("gaMeasurementIdForSite", () => {
  test("uses the configured GA id when present", () => {
    process.env.GA_MEASUREMENT_ID = "G-EXAMPLE123";
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe(
      "G-EXAMPLE123",
    );
  });

  test("an explicit empty GA env disables analytics for template installs", () => {
    process.env.GA_MEASUREMENT_ID = "";
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe("");
    expect(gaMeasurementIdForSite("https://akieguchi.com")).toBe("");
  });

  test("returns empty when GA_MEASUREMENT_ID is unset", () => {
    delete process.env.GA_MEASUREMENT_ID;
    expect(gaMeasurementIdForSite("https://akieguchi.com")).toBe("");
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe("");
  });
});
