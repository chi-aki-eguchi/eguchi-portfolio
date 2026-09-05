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

  test("pending sales disclosure stays readable but out of search on the owner site", () => {
    const owner = injectOgp(
      HTML,
      { siteUrl: "https://akieguchi.com", siteNameEn: "Aki Eguchi" },
      "/legal",
    );
    expect(owner).toContain("販売条件・特定商取引法に基づく表記");
    expect(owner).toContain('name="robots" content="noindex, follow"');
    expect(owner).not.toContain('type="application/ld+json"');

    const distributed = injectOgp(
      HTML,
      {
        siteUrl: "https://portfolio.example",
        siteNameEn: "Photographer",
        profileBioEn: "English content is configured.",
      },
      "/legal",
    );
    expect(distributed).toContain("<title>Not Found");
    expect(distributed).toContain('name="robots" content="noindex, nofollow"');
    expect(distributed).not.toContain('hreflang="ja"');
    expect(distributed).not.toContain('hreflang="en"');
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

  test("non-JavaScript fallback contains the buyer warning and confirmed timing", () => {
    const text = publicPageFallbackText(
      { siteUrl: "https://akieguchi.com" },
      "/legal",
    );
    expect(text.heading).toBe("特定商取引法に基づく表記・販売条件");
    expect(text.paragraphs.join(" ")).toContain(
      "回答を受けるまでは決済へ進まないでください",
    );
    expect(text.paragraphs.join(" ")).toContain("決済後24時間以内");
    expect(text.paragraphs.join(" ")).toContain("素材が揃ってから3日以内");
  });
});
