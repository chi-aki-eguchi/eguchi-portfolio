import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioBridge, studioHref } from "./StudioBridge";

describe("Studio integration belongs only to Aki's site", () => {
  test("customer sites and unknown settings get no promotion", () => {
    for (const siteUrl of [undefined, "https://customer.example", "https://akieguchi.com.example"]) {
      expect(renderToStaticMarkup(<StudioBridge siteUrl={siteUrl} />)).toBe("");
    }
  });
  test("owner page renders compact pricing footer in Japanese", () => {
    const html = renderToStaticMarkup(<StudioBridge siteUrl="https://akieguchi.com" />);
    expect(html).toContain('data-studio-bridge="footer"');
    expect(html).toContain("ポートフォリオ制作・料金を見る →");
    expect(html).toContain('href="/portfolio-kit#pricing"');
    expect(html).not.toContain("PORTFOLIO STUDIO / BY AKI EGUCHI");
  });
  test("English footer uses same-origin pricing link label", () => {
    expect(renderToStaticMarkup(<StudioBridge siteUrl="https://akieguchi.com" language="en" compact />)).toContain("Portfolio websites &amp; pricing →");
  });
  test("links carry no visitor identifier", () => {
    const url = new URL(studioHref("/tools/readiness", "footer"));
    expect(url.hostname).toBe("photo-work-pricing.chi-aki-18.chatgpt.site");
    expect(url.searchParams.get("utm_source")).toBe("partner");
    expect(url.searchParams.size).toBe(4);
  });
});
