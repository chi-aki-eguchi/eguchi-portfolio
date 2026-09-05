import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioBridge, studioHref } from "./StudioBridge";

describe("Studio integration belongs only to Aki's site", () => {
  test("customer sites and unknown settings get no promotion", () => {
    for (const siteUrl of [undefined, "https://customer.example", "https://akieguchi.com.example"]) {
      expect(renderToStaticMarkup(<StudioBridge siteUrl={siteUrl} />)).toBe("");
    }
  });
  test("owner sales page explains the inclusive price and free check", () => {
    const html = renderToStaticMarkup(<StudioBridge siteUrl="https://akieguchi.com" />);
    expect(html).toContain("69,800円");
    expect(html).toContain("3万円が別途加算されることはありません");
    expect(html).toContain("/tools/readiness?");
  });
  test("English customers are told the destination is Japanese", () => {
    expect(renderToStaticMarkup(<StudioBridge siteUrl="https://akieguchi.com" language="en" compact />)).toContain("(Japanese)");
  });
  test("links carry no visitor identifier", () => {
    const url = new URL(studioHref("/tools/readiness", "footer"));
    expect(url.hostname).toBe("photo-work-pricing.chi-aki-18.chatgpt.site");
    expect(url.searchParams.get("utm_source")).toBe("partner");
    expect(url.searchParams.size).toBe(4);
  });
});
