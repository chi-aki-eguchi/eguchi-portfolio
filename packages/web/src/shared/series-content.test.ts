import { describe, expect, test } from "bun:test";
import { parseSeriesContent, parseSeriesContentDraft, publicSeriesContent, safeContentUrl, hasTextIntroduction } from "./series-content";
const text = { id: "a", type: "text", heading: "担当", text: "企画から実施まで\n担当しました。" };
const raw = (blocks: unknown[], enabled = true) => JSON.stringify({ version: 1, enabled, blocks });
describe("optional project content", () => {
  test("unfinished link drafts can be restored but cannot be published", () => {
    const value = raw([{ id: "link", type: "link", label: "入力途中", url: "https://", description: "" }]);
    expect(parseSeriesContentDraft(value)?.blocks[0]).toMatchObject({ url: "https://" });
    expect(() => parseSeriesContent(value)).toThrow();
    expect(publicSeriesContent(value, new Set())).toBeNull();
  });
  test("old rows stay unchanged; text-only projects qualify for the index", () => {
    expect(parseSeriesContent(null)).toBeNull();
    expect(parseSeriesContent(raw([text]))?.blocks).toEqual([text]);
    expect(hasTextIntroduction(raw([text]))).toBe(true);
    expect(hasTextIntroduction(raw([text], false))).toBe(false);
    expect(hasTextIntroduction(raw([]))).toBe(false);
  });
  test("disabled copy and hidden image captions are not public", () => {
    expect(publicSeriesContent(raw([text], false), new Set())).toBeNull();
    const value = publicSeriesContent(raw([text, { id: "b", type: "image", photoId: 7, caption: "private" }]), new Set());
    expect(JSON.parse(value!).blocks).toEqual([text]);
    expect(publicSeriesContent("invalid", new Set())).toBeNull();
  });
  test("rejects executable URLs, credentials, unknown blocks and oversized input", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "//example.com", "https://user:pass@example.com"]) {
      expect(safeContentUrl(url)).toBeNull();
      expect(() => parseSeriesContent(raw([{ id: "b", type: "link", label: "x", url, description: "" }]))).toThrow();
    }
    expect(safeContentUrl("https://example.com/a?q=1")).toBe("https://example.com/a?q=1");
    expect(() => parseSeriesContent(raw([text, text]))).toThrow();
    expect(() => parseSeriesContent(raw([{ id: "b", type: "html" }]))).toThrow();
    expect(() => parseSeriesContent(raw([{ ...text, text: "a".repeat(20_001) }]))).toThrow();
  });
});
