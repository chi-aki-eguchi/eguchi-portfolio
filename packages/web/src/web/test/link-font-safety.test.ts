import { test, expect, describe } from "bun:test";
import { safeHref } from "../lib/utils";
import { safeFontFamily, safeFontUrl } from "../components/provider";

// 2026-08-05: settings strings reached two outputs without any check —
// service.tsx rendered them straight into href/to, and the custom-font CSS
// concatenated them into a quoted @font-face rule where a quote or brace ends
// the rule and starts an attacker-chosen one.
describe("settings strings that reach links and CSS", () => {
  test("safeHref refuses schemes that are not http(s)/mailto", () => {
    expect(safeHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeHref("mailto:a@example.com")).toBe("mailto:a@example.com");
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "vbscript:msgbox",
      "  javascript:alert(1)",
    ])
      expect(safeHref(bad)).toBe("#");
  });

  test("a font family cannot close its CSS string or rule", () => {
    expect(safeFontFamily("My Font-2")).toBe("My Font-2");
    expect(safeFontFamily("日本語フォント")).toBe("日本語フォント");
    for (const bad of [
      "x'; } body { display:none } @font-face { font-family:'y",
      'x"; }',
      "x{}",
      "x\\3c script",
    ]) {
      const out = safeFontFamily(bad);
      expect(out).not.toContain("'");
      expect(out).not.toContain('"');
      expect(out).not.toContain("{");
      expect(out).not.toContain("}");
      expect(out).not.toContain(";");
    }
  });

  test("a font URL must be same-site or http(s), and cannot end the url() token", () => {
    expect(safeFontUrl("/fonts/a.woff2")).toBe("/fonts/a.woff2");
    expect(safeFontUrl("https://cdn.example.com/a.woff2")).toBe(
      "https://cdn.example.com/a.woff2",
    );
    for (const bad of [
      "javascript:alert(1)",
      "//evil.example.com/a.woff2",
      "/fonts/a.woff2'); } body { display:none } @font-face { src: url('x",
      'https://e.example/a.woff2")',
      "",
      "   ",
    ])
      expect(safeFontUrl(bad)).toBeNull();
  });
});
