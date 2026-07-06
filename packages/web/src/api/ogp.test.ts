import { describe, test, expect } from "bun:test";
import { escapeHtml, setAttr } from "./ogp";

describe("escapeHtml", () => {
  test("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  test("escapes & first so other entities aren't double-escaped", () => {
    // If `<` were escaped before `&`, the resulting "&lt;" would become "&amp;lt;".
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("neutralises a script-injection payload", () => {
    const out = escapeHtml(`"><script>alert(1)</script>`);
    expect(out).toBe("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain(`"`);
  });

  test("neutralises an attribute-breakout payload", () => {
    // A value that tries to close the attribute and add an event handler.
    const out = escapeHtml(`" onmouseover="alert(1)`);
    expect(out).not.toContain(`"`);
    expect(out).toBe("&quot; onmouseover=&quot;alert(1)");
  });

  test("leaves safe text unchanged", () => {
    expect(escapeHtml("江口秋 | Photography 2024")).toBe(
      "江口秋 | Photography 2024",
    );
    expect(escapeHtml("")).toBe("");
  });
});

describe("setAttr", () => {
  const re = /(<meta\s+property="og:title"\s+content=")[^"]*(")/;

  test("substitutes the value between the captured groups, escaped", () => {
    const html = `<meta property="og:title" content="OLD">`;
    expect(setAttr(html, re, "New & Bright")).toBe(
      `<meta property="og:title" content="New &amp; Bright">`,
    );
  });

  test("an injected value cannot break out of the attribute", () => {
    const html = `<meta property="og:title" content="OLD">`;
    const out = setAttr(html, re, `"><script>alert(1)</script>`);
    expect(out).toBe(
      `<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">`,
    );
    expect(out).not.toContain("<script>");
    // Exactly one real (unescaped) content attribute remains.
    expect(out.match(/content="/g)).toHaveLength(1);
  });

  test("a `$` in the value is inserted literally, not as a replacement pattern", () => {
    const html = `<meta property="og:title" content="OLD">`;
    // $1 / $$ would expand if a plain string replacement were used instead of a
    // function replacer. (No &<>"' here, so escaping doesn't change the value.)
    expect(setAttr(html, re, "plan $1 $2 $$")).toBe(
      `<meta property="og:title" content="plan $1 $2 $$">`,
    );
  });

  test("no match → html returned unchanged", () => {
    const html = `<meta name="other" content="x">`;
    expect(setAttr(html, re, "whatever")).toBe(html);
  });
});

describe("injectOgp robots policy", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;
  const robotsOf = (html: string) =>
    html.match(/name="robots" content="([^"]*)"/)?.[1];

  test("known static routes stay indexable", () => {
    expect(robotsOf(injectOgp(page, {}, "/"))).toBe("index, follow");
    expect(robotsOf(injectOgp(page, {}, "/gallery"))).toBe("index, follow");
  });

  test("a resolved series slug is indexable; an unknown slug is a noindex soft-404", () => {
    // Regression guard for the 2026-06-12 fix: /series/<junk> renders the SPA
    // not-found view with HTTP 200 — it must never be indexable.
    expect(
      robotsOf(
        injectOgp(page, {}, "/series/real", "", { title: "indigo blue" }),
      ),
    ).toBe("index, follow");
    expect(robotsOf(injectOgp(page, {}, "/series/zzz-not-exist"))).toBe(
      "noindex, nofollow",
    );
  });

  test("admin and unknown paths are noindex", () => {
    expect(robotsOf(injectOgp(page, {}, "/admin"))).toBe("noindex, nofollow");
    const unknown = injectOgp(page, {}, "/no-such-page");
    expect(robotsOf(unknown)).toBe(
      "noindex, nofollow",
    );
    expect(unknown).toContain("<title>Not Found | Photographer Name | Photography</title>");
    expect(unknown).toContain(
      'og:title" content="Not Found | Photographer Name | Photography"',
    );
    expect(unknown).toContain("お探しのページは見つかりませんでした。");
  });

  test("series override title reaches <title> and og:title", () => {
    const out = injectOgp(
      page,
      { siteNameEn: "Aki Eguchi", heroSubtitle: "Photography" },
      "/series/indigoblue",
      "",
      { title: "indigo blue" },
    );
    expect(out).toContain(
      "<title>indigo blue | Aki Eguchi | Photography</title>",
    );
    expect(out).toContain(
      'og:title" content="indigo blue | Aki Eguchi | Photography"',
    );
  });

  test("home title merges the subtitle into the EN name (bilingual names configured)", () => {
    // Regression guard: the client-side usePageTitle hook used to compose a
    // different (2-segment, EN-name-less) title than this SSR output, so GA
    // recorded two different titles for "/". Both now share composeHomeTitle.
    const out = injectOgp(
      page,
      { siteName: "江口 秋", siteNameEn: "Aki Eguchi", heroSubtitle: "Photography" },
      "/",
    );
    expect(out).toContain("<title>江口 秋 | Aki Eguchi Photography</title>");
    expect(out).toContain(
      'og:title" content="江口 秋 | Aki Eguchi Photography"',
    );
  });

  test("subpages keep the pipe-separated pattern even with bilingual names", () => {
    const out = injectOgp(
      page,
      { siteName: "江口 秋", siteNameEn: "Aki Eguchi", heroSubtitle: "Photography" },
      "/gallery",
    );
    expect(out).toContain(
      "<title>Gallery | 江口 秋 | Aki Eguchi | Photography</title>",
    );
  });
});

describe("injectOgp google-site-verification", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;

  test("emits the meta tag (escaped) when the setting is present", () => {
    const out = injectOgp(page, { googleSiteVerification: 'AbC"123' }, "/");
    expect(out).toContain(
      '<meta name="google-site-verification" content="AbC&quot;123">',
    );
  });

  test("emits nothing when unset", () => {
    expect(injectOgp(page, {}, "/")).not.toContain("google-site-verification");
  });
});

describe("siteUrlFrom / base-URL unification", () => {
  const { siteUrlFrom, injectOgp, DEFAULT_SITE_URL } =
    require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;

  test("resolution order: settings.siteUrl → SITE_URL env → request origin → generic default", () => {
    const prevSiteUrl = process.env.SITE_URL;
    delete process.env.SITE_URL;
    try {
      expect(DEFAULT_SITE_URL).toBe("https://example.com");
      expect(siteUrlFrom({}, "https://portfolio.example")).toBe(
        "https://portfolio.example",
      );
      expect(siteUrlFrom({})).toBe("https://example.com");
      process.env.SITE_URL = "https://env.example/";
      expect(siteUrlFrom({}, "https://portfolio.example")).toBe(
        "https://env.example",
      );
      expect(
        siteUrlFrom(
          { siteUrl: "https://example.jp/" },
          "https://portfolio.example",
        ),
      ).toBe("https://example.jp"); // 末尾スラッシュ除去
    } finally {
      if (prevSiteUrl === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = prevSiteUrl;
    }
  });

  test("canonical / og:url / JSON-LD all follow the configured base", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/gallery",
    );
    expect(out).toContain(
      'rel="canonical" href="https://akieguchi.com/gallery"',
    );
    expect(out).toContain(
      'property="og:url" content="https://akieguchi.com/gallery"',
    );
    expect(out).toContain('"url":"https://akieguchi.com/gallery"'); // JSON-LD ImageGallery
    expect(out).not.toContain("runable.site");
  });

  test("canonical / og:url can fall back to the request origin when no site URL is configured", () => {
    const prevSiteUrl = process.env.SITE_URL;
    delete process.env.SITE_URL;
    try {
      const out = injectOgp(
        page,
        {},
        "/gallery",
        "",
        undefined,
        "https://portfolio.example",
      );
      expect(out).toContain(
        'rel="canonical" href="https://portfolio.example/gallery"',
      );
      expect(out).toContain(
        'property="og:url" content="https://portfolio.example/gallery"',
      );
      expect(out).toContain('"url":"https://portfolio.example/gallery"');
      expect(out).not.toContain("akieguchi.com");
    } finally {
      if (prevSiteUrl === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = prevSiteUrl;
    }
  });

  test("missing English name and description derive from the stored site name", () => {
    const out = injectOgp(
      page,
      { siteName: "江口 秋" },
      "/",
      "",
      undefined,
      "https://akieguchi.com",
    );
    expect(out).toContain("<title>江口 秋 | Photography</title>");
    expect(out).toContain(
      'name="description" content="江口 秋の写真ポートフォリオ。"',
    );
    expect(out).toContain('"name":"江口 秋"');
    expect(out).not.toContain("Photographer Name");
  });
});

describe("injectOgp social image metadata", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta property="og:image" content="x" />
    <meta property="og:image:secure_url" content="x" />
    <meta property="og:image:type" content="x" />
    <meta property="og:image:width" content="x" />
    <meta property="og:image:height" content="x" />
    <meta property="og:image:alt" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    <meta name="twitter:image" content="x" />
    <meta name="twitter:image:alt" content="x" />
    </head><body></body></html>`;

  test("uses the hero photo as a fixed-size JPEG card image", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/",
      "/api/images/photos/hero.jpg",
      undefined,
      "",
      90,
    );
    expect(out).toContain(
      'property="og:image" content="https://akieguchi.com/api/images/photos/hero.jpg?w=1200&amp;h=630&amp;q=90&amp;fmt=jpeg&amp;rot=90"',
    );
    expect(out).toContain('property="og:image:type" content="image/jpeg"');
    expect(out).toContain('property="og:image:width" content="1200"');
    expect(out).toContain('property="og:image:height" content="630"');
    expect(out).toContain('name="twitter:image:alt"');
  });

  test("keeps generated medium variants usable as social card sources", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/",
      "/api/images/medium/hero.webp",
      undefined,
      "",
      180,
    );
    expect(out).toContain(
      'property="og:image" content="https://akieguchi.com/api/images/medium/hero.webp?w=1200&amp;h=630&amp;q=90&amp;fmt=jpeg&amp;rot=180"',
    );
    expect(out).toContain(
      'name="twitter:image" content="https://akieguchi.com/api/images/medium/hero.webp?w=1200&amp;h=630&amp;q=90&amp;fmt=jpeg&amp;rot=180"',
    );
  });

  test("falls back to the static template image as an absolute URL", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://portfolio.example" },
      "/gallery",
    );
    expect(out).toContain(
      'property="og:image" content="https://portfolio.example/og-image.jpg"',
    );
    expect(out).toContain(
      'name="twitter:image" content="https://portfolio.example/og-image.jpg"',
    );
  });
});

describe("injectOgp JSON-LD WebSite node", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;
  const ldOf = (html: string) =>
    JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )?.[1] ?? "{}",
    );

  test("graph includes a WebSite node tied to the site URL and language", () => {
    const graph = ldOf(
      injectOgp(
        page,
        {
          siteUrl: "https://akieguchi.com",
          siteNameEn: "Aki Eguchi",
          siteName: "江口秋",
        },
        "/",
      ),
    )["@graph"];
    const site = graph.find(
      (n: { "@type": string }) => n["@type"] === "WebSite",
    );
    expect(site).toBeTruthy();
    expect(site.url).toBe("https://akieguchi.com");
    expect(site.name).toBe("Aki Eguchi");
    expect(site.alternateName).toBe("江口秋");
    expect(site.inLanguage).toBe("ja");
    expect(site.publisher).toEqual({ "@type": "Person", name: "江口秋" });
  });

  test("WebSite coexists with the existing Person + ImageGallery nodes", () => {
    const types = ldOf(injectOgp(page, {}, "/"))["@graph"].map(
      (n: { "@type": string }) => n["@type"],
    );
    expect(types).toContain("WebSite");
    expect(types).toContain("Person");
    expect(types).toContain("ImageGallery");
  });

  test("Person node has a Japanese jobTitle, sameAs from the configured SNS links, and a bio-derived description", () => {
    const graph = ldOf(
      injectOgp(
        page,
        {
          siteUrl: "https://akieguchi.com",
          siteName: "江口 秋",
          siteNameEn: "Aki Eguchi",
          profileBio: "東京在住の写真家です。\n\nBorn in Tokyo.",
          profileInstagram: "https://www.instagram.com/chi._.aki._/",
          profileTwitter: "https://x.com/chi_aki_jpg",
          profileNote: "https://note.com/chi_aki_zip",
          profilePhotoUrl: "/api/images/profile/1-x.jpg",
        },
        "/",
      ),
    )["@graph"];
    const person = graph.find(
      (n: { "@type": string }) => n["@type"] === "Person",
    );
    expect(person.jobTitle).toBe("写真家");
    expect(person.description).toBe("東京在住の写真家です。");
    expect(person.sameAs).toEqual([
      "https://www.instagram.com/chi._.aki._/",
      "https://x.com/chi_aki_jpg",
      "https://note.com/chi_aki_zip",
    ]);
    expect(person.image).toContain("/api/images/profile/1-x.jpg");
  });

  test("Person description falls back to the site description when no bio is set", () => {
    const graph = ldOf(
      injectOgp(
        page,
        { siteUrl: "https://akieguchi.com", siteName: "江口 秋" },
        "/",
      ),
    )["@graph"];
    const person = graph.find(
      (n: { "@type": string }) => n["@type"] === "Person",
    );
    expect(person.description).toBe("江口 秋の写真ポートフォリオ。");
  });
});

describe("injectOgp theme-color", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#f7f7f7" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;
  const themeOf = (html: string) =>
    html.match(/name="theme-color" content="([^"]*)"/)?.[1];

  test("reflects the configured themeBg so mobile chrome matches from first paint", () => {
    expect(themeOf(injectOgp(page, { themeBg: "#111111" }, "/"))).toBe(
      "#111111",
    );
  });

  test("falls back to the static light default when themeBg is unset", () => {
    expect(themeOf(injectOgp(page, {}, "/"))).toBe("#f7f7f7");
  });

  test("replaces in place — no duplicate theme-color meta", () => {
    const out = injectOgp(page, { themeBg: "#111111" }, "/");
    expect(out.match(/name="theme-color"/g)).toHaveLength(1);
  });
});

describe("injectOgp /service route", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;

  test("uses dedicated service OGP title and description, not the photographer's", () => {
    const out = injectOgp(
      page,
      {
        siteName: "Aki Eguchi",
        siteNameEn: "Aki Eguchi",
        siteUrl: "https://akieguchi.com",
      },
      "/service",
    );
    expect(out).toContain("写真家のためのポートフォリオサイト");
    expect(out).toContain("写真を上げて並べるだけで");
    expect(out).not.toContain("<title>Aki Eguchi");
  });

  test("/service is indexable on akieguchi.com", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/service",
    );
    expect(out).toContain('name="robots" content="index, follow"');
  });

  test("/service/start is direct-link only on akieguchi.com and does not replace the buyer-only Deploy link", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/service/start",
    );
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).toContain("Aki Eguchi Portfolio Kit");
    expect(out).not.toContain("railway.com/deploy");
  });

  test("/service is noindex on non-akieguchi hosts", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://other-site.com" },
      "/service",
    );
    expect(out).toContain("noindex, nofollow");
    expect(out).toContain("<title>Not Found | Photographer Name | Photography</title>");
    expect(out).not.toContain("写真家のためのポートフォリオサイト");
  });

  test("/service/start is noindex on non-akieguchi hosts", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://other-site.com" },
      "/service/start",
    );
    expect(out).toContain("noindex, nofollow");
    expect(out).toContain("<title>Not Found | Photographer Name | Photography</title>");
    expect(out).not.toContain("Aki Eguchi Portfolio Kit");
  });

  test("/service title does not include the photographer name", () => {
    const out = injectOgp(
      page,
      { siteName: "Aki Eguchi", siteUrl: "https://akieguchi.com" },
      "/service",
    );
    expect(out).toContain("<title>写真家のためのポートフォリオサイト</title>");
    expect(out).not.toContain("<title>Aki Eguchi");
  });
});

describe("injectOgp /profile canonical", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;

  test("/profile canonicalises to /about to avoid duplicate content", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/profile",
    );
    expect(out).toContain('rel="canonical" href="https://akieguchi.com/about"');
    expect(out).toContain(
      'property="og:url" content="https://akieguchi.com/about"',
    );
    expect(out).not.toContain("/profile");
  });
});

describe("injectOgp per-page meta description", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;
  const descOf = (html: string) =>
    html.match(/name="description" content="([^"]*)"/)?.[1];

  test("each configured metaDescription* setting is used verbatim and doesn't leak to other pages", () => {
    const settings = {
      metaDescriptionHome: "home desc unique",
      metaDescriptionGallery: "gallery desc unique",
      metaDescriptionAbout: "about desc unique",
      metaDescriptionSeries: "series desc unique",
      metaDescriptionContact: "contact desc unique",
    };
    const home = injectOgp(page, settings, "/");
    const gallery = injectOgp(page, settings, "/gallery");
    const about = injectOgp(page, settings, "/about");
    const seriesList = injectOgp(page, settings, "/series");
    const contact = injectOgp(page, settings, "/contact");

    expect(descOf(home)).toBe("home desc unique");
    expect(descOf(gallery)).toBe("gallery desc unique");
    expect(descOf(about)).toBe("about desc unique");
    expect(descOf(seriesList)).toBe("series desc unique");
    expect(descOf(contact)).toBe("contact desc unique");

    // A page's own configured text must not show up on an unrelated page.
    expect(contact).not.toContain("gallery desc unique");
    expect(gallery).not.toContain("contact desc unique");
  });

  test("/profile shares the /about metaDescriptionAbout setting (same canonical page)", () => {
    const out = injectOgp(
      page,
      { metaDescriptionAbout: "about desc unique" },
      "/profile",
    );
    expect(descOf(out)).toBe("about desc unique");
  });

  test("with no settings configured, Home/Gallery/About/Series/Contact each get a different generic fallback", () => {
    const home = descOf(injectOgp(page, {}, "/"));
    const gallery = descOf(injectOgp(page, {}, "/gallery"));
    const about = descOf(injectOgp(page, {}, "/about"));
    const seriesList = descOf(injectOgp(page, {}, "/series"));
    const contact = descOf(injectOgp(page, {}, "/contact"));

    const all = [home, gallery, about, seriesList, contact];
    expect(new Set(all).size).toBe(all.length);

    expect(gallery).toContain("ギャラリー");
    expect(seriesList).toContain("シリーズ");
    expect(about).toContain("プロフィール");
    expect(contact).toContain("連絡先");
  });

  test("a series with no statement/subtitle still names the series, not the fully generic site description", () => {
    const out = injectOgp(
      page,
      { siteName: "江口 秋" },
      "/series/indigoblue",
      "",
      { title: "indigo blue", desc: "" },
    );
    const desc = descOf(out);
    expect(desc).toContain("indigo blue");
    expect(desc).not.toBe("江口 秋の写真ポートフォリオ。");
  });

  test("a series with a configured statement/subtitle keeps using it verbatim", () => {
    const out = injectOgp(
      page,
      { siteName: "江口 秋" },
      "/series/indigoblue",
      "",
      { title: "indigo blue", desc: "藍染めをテーマにした作品群。" },
    );
    expect(descOf(out)).toBe("藍染めをテーマにした作品群。");
  });
});
