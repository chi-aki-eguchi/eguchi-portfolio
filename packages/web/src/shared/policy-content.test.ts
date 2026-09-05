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
    expect(POLICY_PATHS).toHaveLength(6);
    for (const path of POLICY_PATHS) {
      expect(policyRoute(path)).not.toBeNull();
      expect(policyRoute(`${path}/`)).toEqual(policyRoute(path));
    }
    expect(policyPath("legal", "ja")).toBe("/legal");
    expect(policyPath("legal", "en")).toBe("/legal/en");
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

  test("sales disclosure exposes every unresolved owner input instead of inventing it", () => {
    const doc = policyDocument("legal", "ja");
    const pending = doc.sections
      .flatMap((section) => section.rows ?? [])
      .filter((row) => row.pending)
      .map((row) => row.label);

    expect(pending).toEqual([
      "販売事業者の氏名または名称",
      "住所",
      "電話番号",
      "販売価格",
      "適用条件",
    ]);
    const text = allText(doc);
    expect(text).toContain("¥30,000");
    expect(text).toContain("決済後24時間以内");
    expect(text).toContain("素材が揃ってから3日以内");
    expect(text).toContain("回答を受けるまでは決済へ進まないでください");
    expect(text).not.toMatch(/〒\s*\d|0\d{1,4}-\d{1,4}-\d{3,4}|TODO|TBD/);
  });

  test("English documents contain their own English copy", () => {
    for (const kind of ["privacy", "terms", "legal"] as const) {
      const text = allText(policyDocument(kind, "en"));
      expect(text).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
    }
  });
});
