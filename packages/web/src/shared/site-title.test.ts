import { describe, test, expect } from "bun:test";
import { composeBaseTitle, composeHomeTitle, composePageTitle } from "./site-title";

const parts = { nameJa: "江口 秋", nameEn: "Aki Eguchi", subtitle: "Photography" };

describe("composeHomeTitle", () => {
  test("merges the subtitle into the EN name without a pipe", () => {
    expect(composeHomeTitle(parts)).toBe("江口 秋 | Aki Eguchi Photography");
  });

  test("falls back to the pipe-joined shape when JA name matches EN name", () => {
    expect(
      composeHomeTitle({ nameJa: "Aki Eguchi", nameEn: "Aki Eguchi", subtitle: "Photography" }),
    ).toBe("Aki Eguchi | Photography");
  });

  test("falls back to the pipe-joined shape when no JA name is configured", () => {
    expect(
      composeHomeTitle({ nameJa: "", nameEn: "Photographer Name", subtitle: "Photography" }),
    ).toBe("Photographer Name | Photography");
  });

  test("omits the trailing space when subtitle is empty", () => {
    expect(composeHomeTitle({ ...parts, subtitle: "" })).toBe("江口 秋 | Aki Eguchi");
  });
});

describe("composeBaseTitle", () => {
  test("keeps all three segments pipe-separated", () => {
    expect(composeBaseTitle(parts)).toBe("江口 秋 | Aki Eguchi | Photography");
  });
});

describe("composePageTitle", () => {
  test("home (no page) uses the merged home title", () => {
    expect(composePageTitle(undefined, parts)).toBe("江口 秋 | Aki Eguchi Photography");
  });

  test("subpages prefix the page name onto the pipe-separated base", () => {
    expect(composePageTitle("Gallery", parts)).toBe(
      "Gallery | 江口 秋 | Aki Eguchi | Photography",
    );
  });
});
