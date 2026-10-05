import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SeriesContent } from "../components/SeriesContent";
import type { SeriesContent as Content } from "../../shared/series-content";
describe("project copy renders without a photograph requirement", () => {
  test("preserves block order, escapes prose and omits unsafe or absent media", () => {
    const content: Content = { version: 1, enabled: true, blocks: [
      { id: "t", type: "text", heading: "Background", text: "<script>alert(1)</script>\nSecond line" },
      { id: "hidden", type: "image", photoId: 999, caption: "unavailable caption" },
      { id: "bad", type: "link", url: "javascript:alert(1)", label: "bad", description: "bad" },
      { id: "link", type: "link", url: "https://example.com/", label: "Published article", description: "Read it" },
      { id: "facts", type: "facts", items: [{ label: "Role", value: "Editor" }] },
    ] };
    const html = renderToStaticMarkup(createElement(SeriesContent, { content, photos: [] }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("unavailable caption");
    expect(html).not.toContain("javascript:");
    expect(html.indexOf("Background")).toBeLessThan(html.indexOf("Published article"));
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Editor");
  });
});
