import { describe, expect, test } from "bun:test";
import { injectOgp, publicPageFallbackText } from "./ogp";

const HTML = `<!doctype html>
<html lang="ja"><head>
<title>Photography</title>
<meta name="description" content="">
<meta name="author" content="">
<meta name="robots" content="index, follow">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="">
<meta property="og:description" content="">
<meta property="og:url" content="">
<link rel="canonical" href="">
</head><body></body></html>`;

describe("policy route metadata", () => {
  test("English privacy has English title, locale, canonical and reciprocal hreflang", () => {
    const out = injectOgp(
      HTML,
      { siteUrl: "https://akieguchi.com", siteNameEn: "Aki Eguchi" },
      "/privacy/en",
    );
    expect(out).toContain("<html lang=\"en\"");
    expect(out).toContain("<title>Privacy Policy | Aki Eguchi | Photography</title>");
    expect(out).toContain(
      '<link rel="canonical" href="https://akieguchi.com/privacy/en">',
    );
    expect(out).toContain(
      '<link rel="alternate" hreflang="ja" href="https://akieguchi.com/privacy">',
    );
    expect(out).toContain(
      '<link rel="alternate" hreflang="en" href="https://akieguchi.com/privacy/en">',
    );
  });

  test("unpublished sales disclosure is a missing page for every host", () => {
    for (const siteUrl of ["https://akieguchi.com", "https://portfolio.example"]) {
      const out = injectOgp(HTML, { siteUrl, siteNameEn: "Photographer" }, "/legal");
      expect(out).toContain("<title>Not Found");
      expect(out).toContain('name="robots" content="noindex, nofollow"');
      expect(out).not.toContain('hreflang="ja"');
      expect(out).not.toContain('hreflang="en"');
    }
  });

  test("distributed fallback does not inherit owner-only sales copy when siteUrl is empty", () => {
    const text = publicPageFallbackText(
      {},
      "/privacy",
      undefined,
      "https://portfolio.example",
    );
    expect(text.paragraphs.join(" ")).not.toContain("Stripe");
    expect(text.paragraphs.join(" ")).not.toContain("Portfolio Kit");
  });

  test("non-JavaScript privacy fallback describes the real contact form", () => {
    const text = publicPageFallbackText({ siteUrl: "https://akieguchi.com" }, "/privacy");
    expect(text.heading).toBe("プライバシーポリシー");
    expect(text.paragraphs.join(" ")).toContain("メールアドレス");
    expect(text.paragraphs.join(" ")).not.toContain("Portfolio Kit");
  });
});
