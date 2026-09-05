import { describe, expect, test } from "bun:test";
import {
  INDEXABLE_POLICY_PATHS,
  POLICY_PATHS,
  policyDocument,
  policyPath,
  policyRoute,
} from "./policy-content";

function allText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(allText).join(" ");
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>).map(allText).join(" ");
  return "";
}

describe("public policy content", () => {
  test("all JP/EN policy routes resolve, including a trailing slash", () => {
    expect(POLICY_PATHS).toHaveLength(4);
    for (const path of POLICY_PATHS) {
      expect(policyRoute(path)).not.toBeNull();
      expect(policyRoute(`${path}/`)).toEqual(policyRoute(path));
    }
    expect(policyPath("privacy", "ja")).toBe("/privacy");
    expect(policyPath("privacy", "en")).toBe("/privacy/en");
    expect(policyRoute("/legal")).toBeNull();
    expect(policyRoute("/unknown")).toBeNull();
  });

  test("sitemap policy paths omit the sales disclosure while its fields are pending", () => {
    expect(INDEXABLE_POLICY_PATHS).toEqual([
      "/privacy",
      "/privacy/en",
      "/terms",
      "/terms/en",
    ]);
    expect(INDEXABLE_POLICY_PATHS).not.toContain("/legal");
    expect(INDEXABLE_POLICY_PATHS).not.toContain("/legal/en");
  });

  test("privacy policy names the fields the public contact form actually sends", () => {
    const text = allText(policyDocument("privacy", "ja"));
    for (const field of ["お名前", "メールアドレス", "件名（任意）", "メッセージ"]) {
      expect(text).toContain(field);
    }
    expect(text).toContain("ローカルストレージ");
    expect(text).toContain("Google Analytics");
  });

  test("site policies do not adopt a sales proposal or publish pending fields", () => {
    for (const language of ["ja", "en"] as const) {
      for (const kind of ["privacy", "terms"] as const) {
        const text = allText(policyDocument(kind, language));
        expect(text).not.toMatch(/Portfolio Kit|¥30,000|要確認|Pending|TODO|TBD/);
      }
    }
  });

  test("English documents contain their own English copy", () => {
    for (const kind of ["privacy", "terms"] as const) {
      const text = allText(policyDocument(kind, "en"));
      expect(text).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
    }
  });
});
