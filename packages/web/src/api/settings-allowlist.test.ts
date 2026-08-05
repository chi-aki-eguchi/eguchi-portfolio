import { describe, expect, test } from "bun:test";
import {
  isSettingsPayload,
  partitionAllowedSettings,
} from "./settings-allowlist";

describe("isSettingsPayload", () => {
  test("accepts JSON objects but rejects null and arrays", () => {
    expect(isSettingsPayload({ siteName: "Akiko Eguchi" })).toBe(true);
    expect(isSettingsPayload(null)).toBe(false);
    expect(isSettingsPayload([])).toBe(false);
    expect(isSettingsPayload("settings")).toBe(false);
  });
});

describe("partitionAllowedSettings", () => {
  const allowedKeys = new Set(["siteName", "profileBio"]);

  test("allowed keys are kept for writing", () => {
    const { allowed, ignoredKeys } = partitionAllowedSettings(
      { siteName: "Akiko Eguchi", profileBio: "Photographer" },
      allowedKeys,
    );
    expect(allowed).toEqual([
      ["siteName", "Akiko Eguchi"],
      ["profileBio", "Photographer"],
    ]);
    expect(ignoredKeys).toEqual([]);
  });

  test("unknown keys are ignored, not written, and reported back", () => {
    const { allowed, ignoredKeys } = partitionAllowedSettings(
      { siteName: "Akiko Eguchi", totallyUnknownKey: "should not save" },
      allowedKeys,
    );
    expect(allowed).toEqual([["siteName", "Akiko Eguchi"]]);
    expect(ignoredKeys).toEqual(["totallyUnknownKey"]);
  });

  test("non-string values for allowed keys are reported instead of silently skipped", () => {
    const { allowed, ignoredKeys, invalidKeys } = partitionAllowedSettings(
      { siteName: 123 as unknown as string },
      allowedKeys,
    );
    expect(allowed).toEqual([]);
    expect(ignoredKeys).toEqual([]);
    expect(invalidKeys).toEqual(["siteName"]);
  });
});
