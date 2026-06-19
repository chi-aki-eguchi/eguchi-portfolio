import { afterEach, describe, expect, test } from "bun:test";
import { gaMeasurementIdForSite, isAllowedOrigin } from "./site-defaults";

const envSnapshot = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
};

afterEach(() => {
  if (envSnapshot.ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = envSnapshot.ALLOWED_ORIGINS;

  if (envSnapshot.GA_MEASUREMENT_ID === undefined) delete process.env.GA_MEASUREMENT_ID;
  else process.env.GA_MEASUREMENT_ID = envSnapshot.GA_MEASUREMENT_ID;
});

describe("isAllowedOrigin", () => {
  test("always allows localhost development origins", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4200")).toBe(true);
  });

  test("allows configured extra origins and rejects arbitrary origins", () => {
    process.env.ALLOWED_ORIGINS = "https://client.example, https://preview.example/";
    expect(isAllowedOrigin("https://client.example")).toBe(true);
    expect(isAllowedOrigin("https://preview.example")).toBe(true);
    expect(isAllowedOrigin("https://attacker.example")).toBe(false);
  });
});

describe("gaMeasurementIdForSite", () => {
  test("uses the configured GA id when present", () => {
    process.env.GA_MEASUREMENT_ID = "G-EXAMPLE123";
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe("G-EXAMPLE123");
  });

  test("an explicit empty GA env disables analytics for template installs", () => {
    process.env.GA_MEASUREMENT_ID = "";
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe("");
    expect(gaMeasurementIdForSite("https://akieguchi.com")).toBe("");
  });

  test("keeps the legacy analytics fallback only for akieguchi.com", () => {
    delete process.env.GA_MEASUREMENT_ID;
    expect(gaMeasurementIdForSite("https://akieguchi.com")).toBe("G-NKECCDLXYD");
    expect(gaMeasurementIdForSite("https://portfolio.example")).toBe("");
  });
});
