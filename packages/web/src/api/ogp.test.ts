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

  test("photo routes are shareable but noindex until their editorial copy is ready", () => {
    const thin = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/photo/42",
      "",
      {
      title: "2026年6月に撮影した写真",
      desc: "フィルム。",
      image: "/api/images/photos/a.jpg",
      indexable: false,
      },
    );
    expect(thin).not.toContain("Not Found");
    expect(robotsOf(thin)).toBe("noindex, follow");
    expect(thin).not.toContain('"@type":"ImageObject"');
    expect(thin).toContain("send_page_view:false");
    expect(thin).toContain("window.__portfolioInitialPageViewSent=true");
    expect(thin).toContain('page_path:"/photo/:id"');
    expect(thin).not.toContain('page_path:"/photo/42"');

    const edited = injectOgp(
      page,
      { siteUrl: "https://example.com", siteName: "江口秋" },
      "/photo/43",
      "",
      {
        title: "藍の窓",
        desc: "藍染めの布が風を受け、午後の光の中でゆっくり揺れている一枚です。",
        image: "/api/images/photos/b.jpg",
        indexable: true,
      },
    );
    expect(robotsOf(edited)).toBe("index, follow");
    expect(edited).toContain('"@type":"ImageObject"');
  });

  test("admin and unknown paths are noindex", () => {
    expect(robotsOf(injectOgp(page, {}, "/admin"))).toBe("noindex, nofollow");
    expect(robotsOf(injectOgp(page, {}, "/admin/login"))).toBe(
      "noindex, nofollow",
    );
    const unknown = injectOgp(page, {}, "/no-such-page");
    expect(robotsOf(unknown)).toBe("noindex, nofollow");
    expect(unknown).not.toContain("googletagmanager.com");
    expect(unknown).toContain(
      "<title>Not Found | Photographer Name | Photography</title>",
    );
    expect(unknown).toContain(
      'og:title" content="Not Found | Photographer Name | Photography"',
    );
    expect(unknown).toContain("お探しのページは見つかりませんでした。");
  });

  test("a transiently unresolved detail route bootstraps GA without counting a soft-404", () => {
    const unresolved = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/series/temporarily-unavailable",
    );
    expect(robotsOf(unresolved)).toBe("noindex, nofollow");
    expect(unresolved).toContain("googletagmanager.com");
    expect(unresolved).toContain("send_page_view:false");
    expect(unresolved).toContain(
      "window.__portfolioInitialPageViewSent=false",
    );
    expect(unresolved).not.toContain("gtag('event','page_view'");

    const malformed = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/series/too/many/segments",
    );
    expect(malformed).not.toContain("googletagmanager.com");
  });

  /**
   * **公開ページを app.tsx に足したら、ここにも足す。**
   *
   * 2026-08-31、Work の棚（`/work`）を足したのにこの一覧へ入れ忘れ、**画面は
   * 出るのに本番が HTTP 404 を返していた**（共有カードも「Not Found」）。
   * 開発サーバは何でも 200 を返すので、実際に開いても気づけない。
   */
  test("Work の棚は、ちゃんとある page として扱う", () => {
    const work = injectOgp(page, {}, "/work");
    expect(work).not.toContain("Not Found");
    expect(robotsOf(work)).toBe("index, follow");
    expect(work).toContain("<title>Work | ");

    // 1本ぶんは、実在が確かめられたとき（override.title があるとき）だけ。
    // でたらめな slug が普通の共有カードに見えてはいけない。
    const known = injectOgp(page, {}, "/work/kyoto", "", { title: "京都" });
    expect(known).not.toContain("Not Found");
    const unknown = injectOgp(page, {}, "/work/でたらめ");
    expect(unknown).toContain("Not Found");
    expect(robotsOf(unknown)).toBe("noindex, nofollow");
  });

  // 2026-07-10: 正常表示される admin ページが Not Found title になる不整合の
  // 回帰ガード。noindex のまま title だけ実ページ名になること。
  test("admin pages keep noindex but get their real titles (not Not Found)", () => {
    const admin = injectOgp(page, {}, "/admin");
    expect(admin).toContain(
      "<title>Admin | Photographer Name | Photography</title>",
    );
    expect(admin).not.toContain("Not Found");

    const login = injectOgp(page, {}, "/admin/login");
    expect(login).toContain(
      "<title>Admin Login | Photographer Name | Photography</title>",
    );
    expect(login).not.toContain("Not Found");
    expect(login).not.toContain("お探しのページは見つかりませんでした。");
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
      {
        siteName: "江口 秋",
        siteNameEn: "Aki Eguchi",
        heroSubtitle: "Photography",
      },
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
      {
        siteName: "江口 秋",
        siteNameEn: "Aki Eguchi",
        heroSubtitle: "Photography",
      },
      "/gallery",
    );
    expect(out).toContain(
      "<title>Gallery | 江口 秋 | Aki Eguchi | Photography</title>",
    );
  });
});

describe("injectOgp hero preload", () => {
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

  test("uses the same generated candidates and layout hint as the rendered hero", () => {
    const srcSet = [
      "/api/images/thumbs/a.webp 640w",
      "/api/images/medium/a.webp 1920w",
      "/api/images/photos/a.jpg 3200w",
    ].join(", ");
    const out = injectOgp(
      page,
      { heroMode: "editorial" },
      "/",
      "/api/images/medium/a.webp",
      undefined,
      "",
      0,
      "/api/images/medium/a.webp",
      srcSet,
    );

    expect(out).toContain(
      `href="/api/images/medium/a.webp" imagesrcset="${srcSet}" imagesizes="(min-width: 768px) 55vw, 100vw"`,
    );
    expect(out.match(/rel="preload" as="image"/g)).toHaveLength(1);
  });

  test("does not fall back to a guessed proxy preload when random HERO suppresses it", () => {
    const out = injectOgp(
      page,
      { heroMode: "carousel", heroRandom: "shuffle" },
      "/",
      "/api/images/photos/a.jpg",
      undefined,
      "",
      0,
      undefined,
      undefined,
      false,
    );

    expect(out).not.toContain('rel="preload" as="image"');
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

describe("ogCardTitleFrom", () => {
  const { ogCardTitleFrom } = require("./ogp") as typeof import("./ogp");

  test("reuses the bilingual title parts and subtitle", () => {
    expect(
      ogCardTitleFrom({
        siteName: "江口 秋",
        siteNameEn: "Aki Eguchi",
        heroSubtitle: "Photography",
      }),
    ).toBe("江口 秋 | Aki Eguchi | Photography");
  });

  test("uses Photography when the site name and subtitle are empty", () => {
    expect(ogCardTitleFrom({})).toBe("Photography");
    expect(ogCardTitleFrom({ siteName: " ", heroSubtitle: " " })).toBe(
      "Photography",
    );
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

  test.each([
    {
      label: "owner normal page without hero",
      settings: { siteUrl: "https://akieguchi.com" },
      pathname: "/gallery",
      hero: "",
      expected: "https://akieguchi.com/og-image.jpg",
      type: "image/jpeg",
    },
    {
      label: "owner normal page with hero",
      settings: { siteUrl: "https://akieguchi.com" },
      pathname: "/gallery",
      hero: "/api/images/photos/hero.jpg",
      expected:
        "https://akieguchi.com/api/images/photos/hero.jpg?w=1200&amp;h=630&amp;q=90&amp;fmt=jpeg",
      type: "image/jpeg",
    },
    {
      label: "distributed normal page without hero",
      settings: { siteUrl: "https://portfolio.example" },
      pathname: "/gallery",
      hero: "",
      expected: "https://portfolio.example/og-default.png",
      type: "image/png",
    },
    {
      label: "distributed normal page with hero",
      settings: { siteUrl: "https://portfolio.example" },
      pathname: "/gallery",
      hero: "/api/images/photos/hero.jpg",
      expected:
        "https://portfolio.example/api/images/photos/hero.jpg?w=1200&amp;h=630&amp;q=90&amp;fmt=jpeg",
      type: "image/jpeg",
    },
    {
      label: "owner service page without hero",
      settings: { siteUrl: "https://akieguchi.com" },
      pathname: "/portfolio-kit",
      hero: "",
      expected: "https://akieguchi.com/og-service.jpg",
      type: "image/jpeg",
    },
    {
      label: "owner service page with hero",
      settings: { siteUrl: "https://akieguchi.com" },
      pathname: "/portfolio-kit",
      hero: "/api/images/photos/hero.jpg",
      expected: "https://akieguchi.com/og-service.jpg",
      type: "image/jpeg",
    },
    {
      label: "distributed service page without hero",
      settings: {
        siteUrl: "https://portfolio.example",
        servicePageMode: "on",
      },
      pathname: "/portfolio-kit",
      hero: "",
      expected: "https://portfolio.example/og-default.png",
      type: "image/png",
    },
    {
      label: "distributed service page with hero",
      settings: {
        siteUrl: "https://portfolio.example",
        servicePageMode: "on",
      },
      pathname: "/portfolio-kit",
      hero: "/api/images/photos/hero.jpg",
      expected: "https://portfolio.example/og-default.png",
      type: "image/png",
    },
  ])("selects the expected card for $label", ({ settings, pathname, hero, expected, type }) => {
    const out = injectOgp(page, settings, pathname, hero);

    expect(out).toContain(`property="og:image" content="${expected}"`);
    expect(out).toContain(`name="twitter:image" content="${expected}"`);
    expect(out).toContain(`property="og:image:type" content="${type}"`);
    if (expected.endsWith("/og-default.png")) {
      expect(out).not.toContain("og-default.png?");
    }
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

describe("injectOgp /portfolio-kit route", () => {
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
  const localizedPage = page
    .replace("<html>", '<html lang="ja">')
    .replace(
      "</head>",
      '<meta property="og:locale" content="ja_JP" /></head>',
    );

  test("uses dedicated service OGP title and description, not the photographer's", () => {
    const out = injectOgp(
      page,
      {
        siteName: "Aki Eguchi",
        siteNameEn: "Aki Eguchi",
        siteUrl: "https://akieguchi.com",
      },
      "/portfolio-kit",
    );
    expect(out).toContain(
      "<title>写真を置く場所をつくる | 写真家のポートフォリオサイト</title>",
    );
    expect(out).toContain("SNSに流した写真を、長く置いておける場所へ");
  });

  test("/portfolio-kit is indexable on akieguchi.com", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/portfolio-kit",
    );
    expect(out).toContain('name="robots" content="index, follow"');
  });

  test("/portfolio-kit/start is direct-link only on akieguchi.com and does not replace the buyer-only Deploy link", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/portfolio-kit/start",
    );
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).toContain("Aki Eguchi Portfolio Kit");
    expect(out).not.toContain("railway.com/deploy");
  });

  test("/portfolio-kit is noindex on non-akieguchi hosts", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://other-site.com" },
      "/portfolio-kit",
    );
    expect(out).toContain("noindex, nofollow");
    expect(out).toContain(
      "<title>Not Found | Photographer Name | Photography</title>",
    );
    expect(out).not.toContain("Aki Eguchi Portfolio Kit");
  });

  test("servicePageMode on exposes /portfolio-kit on a distributed host", () => {
    const out = injectOgp(
      page,
      { servicePageMode: "on", siteUrl: "https://portfolio.example" },
      "/portfolio-kit",
      "",
      undefined,
      "https://portfolio.example",
    );
    expect(out).toContain('name="robots" content="index, follow"');
    expect(out).toContain("Aki Eguchi Portfolio Kit");
  });

  test("servicePageMode off makes /portfolio-kit unavailable on akieguchi.com", () => {
    const out = injectOgp(
      page,
      { servicePageMode: "off", siteUrl: "https://akieguchi.com" },
      "/portfolio-kit",
      "",
      undefined,
      "https://akieguchi.com",
    );
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).toContain("Not Found");
  });

  test("/portfolio-kit/start is noindex on non-akieguchi hosts", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://other-site.com" },
      "/portfolio-kit/start",
    );
    expect(out).toContain("noindex, nofollow");
    expect(out).toContain(
      "<title>Not Found | Photographer Name | Photography</title>",
    );
    expect(out).not.toContain("Aki Eguchi Portfolio Kit");
  });

  test("/portfolio-kit の題は作品を主語にし、検索の語と商品名も落とさない", () => {
    const out = injectOgp(
      page,
      { siteName: "Aki Eguchi", siteUrl: "https://akieguchi.com" },
      "/portfolio-kit",
    );
    // 商品名だけの題は、その商品を既に知っている人にしか当たらない。だから
    // 検索の語（写真家 / ポートフォリオサイト）は題に残し、商品名は説明で名乗る。
    expect(out).toContain(
      "<title>写真を置く場所をつくる | 写真家のポートフォリオサイト</title>",
    );
    expect(out).toContain("Aki Eguchi Portfolio Kit");
  });

  test("English Portfolio Kit uses English OGP, locale, canonical, and reciprocal hreflang", () => {
    const out = injectOgp(
      localizedPage,
      { siteUrl: "https://akieguchi.com" },
      "/portfolio-kit/en",
    );
    expect(out).toContain(
      "<title>A Place to Keep Your Photographs | Portfolio Websites for Photographers</title>",
    );
    expect(out).toContain("A lasting place for work that otherwise disappears");
    expect(out).toContain(
      'rel="canonical" href="https://akieguchi.com/portfolio-kit/en"',
    );
    expect(out).toContain(
      'property="og:url" content="https://akieguchi.com/portfolio-kit/en"',
    );
    expect(out).toContain(
      'name="twitter:title" content="A Place to Keep Your Photographs | Portfolio Websites for Photographers"',
    );
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('property="og:locale" content="en_US"');
    expect(out).toContain(
      'hreflang="ja" href="https://akieguchi.com/portfolio-kit"',
    );
    expect(out).toContain(
      'hreflang="en" href="https://akieguchi.com/portfolio-kit/en"',
    );
    expect(out).toContain('name="robots" content="index, follow"');
  });

  test("Japanese Portfolio Kit points back to the English alternate", () => {
    const out = injectOgp(
      localizedPage,
      { siteUrl: "https://akieguchi.com" },
      "/portfolio-kit",
    );
    expect(out).toContain(
      'hreflang="ja" href="https://akieguchi.com/portfolio-kit"',
    );
    expect(out).toContain(
      'hreflang="en" href="https://akieguchi.com/portfolio-kit/en"',
    );
  });

  test("English start guide has English OGP and hreflang while staying noindex", () => {
    const out = injectOgp(
      localizedPage,
      { siteUrl: "https://akieguchi.com" },
      "/start/en",
    );
    expect(out).toContain(
      "<title>Aki Eguchi Portfolio Kit — Start Guide</title>",
    );
    expect(out).toContain(
      'rel="canonical" href="https://akieguchi.com/start/en"',
    );
    expect(out).toContain(
      'hreflang="ja" href="https://akieguchi.com/start"',
    );
    expect(out).toContain(
      'hreflang="en" href="https://akieguchi.com/start/en"',
    );
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).toContain('<html lang="en">');
  });

  test("hidden English Portfolio Kit is Not Found and omits hreflang", () => {
    const out = injectOgp(
      localizedPage,
      {
        servicePageMode: "off",
        siteUrl: "https://akieguchi.com",
      },
      "/portfolio-kit/en",
    );
    expect(out).toContain("<title>Not Found");
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).not.toContain('rel="alternate"');
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

describe("injectOgp /en/about and /en/contact (i18n Phase 3 slice 1)", () => {
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
  const localizedPage = page
    .replace("<html>", '<html lang="ja">')
    .replace(
      "</head>",
      '<meta property="og:locale" content="ja_JP" /></head>',
    );
  const descOf = (html: string) =>
    html.match(/name="description" content="([^"]*)"/)?.[1];

  test("titles and stays indexable", () => {
    const about = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/en/about",
    );
    const contact = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/en/contact",
    );
    expect(about).toContain("<title>About |");
    expect(about).toContain('name="robots" content="index, follow"');
    expect(contact).toContain("<title>Contact |");
    expect(contact).toContain('name="robots" content="index, follow"');
  });

  test("sets html lang and og:locale to English, unlike the Japanese pages", () => {
    const enAbout = injectOgp(
      localizedPage,
      { siteUrl: "https://akieguchi.com" },
      "/en/about",
    );
    expect(enAbout).toContain('<html lang="en">');
    expect(enAbout).toContain('property="og:locale" content="en_US"');

    const jaAbout = injectOgp(
      localizedPage,
      { siteUrl: "https://akieguchi.com" },
      "/about",
    );
    expect(jaAbout).toContain('<html lang="ja">');
    expect(jaAbout).toContain('property="og:locale" content="ja_JP"');
  });

  test("canonical for /en/about and /en/contact is the English URL itself, not the JA page", () => {
    const about = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/en/about",
    );
    const contact = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com" },
      "/en/contact",
    );
    expect(about).toContain(
      'rel="canonical" href="https://akieguchi.com/en/about"',
    );
    expect(contact).toContain(
      'rel="canonical" href="https://akieguchi.com/en/contact"',
    );
  });

  // hreflang は英語文が入力済みのサイトでのみ出す（配布テンプレートのガード）。
  const enSettings = {
    siteUrl: "https://akieguchi.com",
    profileBioEn: "English bio.",
  };

  test("reciprocal hreflang between /about and /en/about, and /contact and /en/contact", () => {
    const ja = injectOgp(page, enSettings, "/about");
    const en = injectOgp(page, enSettings, "/en/about");
    for (const out of [ja, en]) {
      expect(out).toContain(
        'hreflang="ja" href="https://akieguchi.com/about"',
      );
      expect(out).toContain(
        'hreflang="en" href="https://akieguchi.com/en/about"',
      );
    }

    const jaContact = injectOgp(page, enSettings, "/contact");
    const enContact = injectOgp(page, enSettings, "/en/contact");
    for (const out of [jaContact, enContact]) {
      expect(out).toContain(
        'hreflang="ja" href="https://akieguchi.com/contact"',
      );
      expect(out).toContain(
        'hreflang="en" href="https://akieguchi.com/en/contact"',
      );
    }
  });

  test("/profile's hreflang alternates point at /about (its canonical), not /profile", () => {
    const out = injectOgp(page, enSettings, "/profile");
    expect(out).toContain(
      'hreflang="ja" href="https://akieguchi.com/about"',
    );
    expect(out).toContain(
      'hreflang="en" href="https://akieguchi.com/en/about"',
    );
  });

  test("without any public English text configured, /about and /en/about emit no hreflang (distributed-template guard)", () => {
    for (const path of ["/about", "/en/about", "/contact", "/en/contact"]) {
      const out = injectOgp(
        page,
        { siteUrl: "https://akieguchi.com" },
        path,
      );
      expect(out).not.toContain('hreflang=');
    }
    // 判定対象は公開EN文のみ — contactEnglishNote(JPページ用の添え書き)では有効化しない。
    const noteOnly = injectOgp(
      page,
      {
        siteUrl: "https://akieguchi.com",
        contactEnglishNote: "English inquiries welcome.",
      },
      "/about",
    );
    expect(noteOnly).not.toContain('hreflang=');
    // どのEN文キーでも1つ入力されれば有効化される。
    const introOnly = injectOgp(
      page,
      {
        siteUrl: "https://akieguchi.com",
        contactIntroEn: "Feel free to reach out.",
      },
      "/contact",
    );
    expect(introOnly).toContain(
      'hreflang="en" href="https://akieguchi.com/en/contact"',
    );
  });

  test("with no settings configured, /en/about and /en/contact get distinct English generic descriptions", () => {
    const about = descOf(injectOgp(page, {}, "/en/about"));
    const contact = descOf(injectOgp(page, {}, "/en/contact"));
    expect(about).toContain("profile page");
    expect(contact).toContain("Contact");
    expect(about).not.toBe(contact);
    // Must not silently fall through to the Japanese generic fallback.
    expect(about).not.toContain("プロフィール");
    expect(contact).not.toContain("連絡先");
  });

  test("日本語ページは metaDescription* の設定をそのまま使う（専用キーを増やさない方針は維持）", () => {
    const settings = {
      metaDescriptionAbout: "about desc unique",
      metaDescriptionContact: "contact desc unique",
    };
    expect(descOf(injectOgp(page, settings, "/about"))).toBe(
      "about desc unique",
    );
    expect(descOf(injectOgp(page, settings, "/contact"))).toBe(
      "contact desc unique",
    );
  });

  test("英語URLに日本語の説明文を出さない（2026-09-01 に方針を一部変更）", () => {
    // 以前はここも metaDescriptionAbout/Contact に相乗りしていた。だが本番の
    // /en/about は `<html lang="en">` を名乗りながら日本語の説明文を出していて、
    // 対になっている日本語ページの重複として扱われやすい。
    // **英語の設定キーは増やさない**方針は維持し、代わりに既に入力されている
    // 英語の本文から作る。
    const settings = {
      metaDescriptionAbout: "日本語の説明",
      metaDescriptionContact: "日本語の説明",
      profileBioEn: "Born in 2007, raised in Taiwan.\n\n二段落目は使わない",
      contactIntroEn: "For shoot requests and collaborations.",
      siteNameEn: "Aki Eguchi",
    };
    expect(descOf(injectOgp(page, settings, "/en/about"))).toBe(
      "Born in 2007, raised in Taiwan.",
    );
    expect(descOf(injectOgp(page, settings, "/en/contact"))).toBe(
      "For shoot requests and collaborations.",
    );
  });

  test("英語の本文が無ければ英語の定型文へ。日本語へは落ちない", () => {
    const settings = {
      metaDescriptionAbout: "日本語の説明",
      siteNameEn: "Aki Eguchi",
      profileBioEn: "",
    };
    const d = descOf(injectOgp(page, settings, "/en/about"));
    // 属性なのでアポストロフィは実体参照になる（escapeHtml の正しい動き）。
    expect(d).toBe("Aki Eguchi&#39;s profile page.");
    expect(d).not.toContain("日本語");
  });
});

describe("injectOgp 販売ページの構造化データ", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html lang="ja"><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;

  const graphOf = (html: string): Record<string, any>[] => {
    const m = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s,
    );
    if (!m) return [];
    return JSON.parse(m[1].replace(/\\u003c/g, "<"))["@graph"];
  };
  const nodeOf = (html: string, type: string) =>
    graphOf(html).find((n) => n["@type"] === type);

  test("値段が Offer として出る（本文の数字は、検索側には値段だと分からない）", () => {
    const product = nodeOf(
      injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/portfolio-kit"),
      "Product",
    );
    expect(product?.offers).toMatchObject({
      "@type": "Offer",
      price: "30000",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
      url: "https://akieguchi.com/portfolio-kit",
    });
    // 公開名と法的な販売者名が同じとは未確認。構造化データだけで販売者を
    // 断定せず、法定表示の確認済み情報を唯一の正本にする。
    expect(product?.offers?.seller).toBeUndefined();
  });

  test("値段は管理画面の設定から読む（既定値を焼き付けない）", () => {
    const product = nodeOf(
      injectOgp(
        page,
        {
          siteUrl: "https://akieguchi.com",
          servicePageConfig: JSON.stringify({
            pricing: {
              plans: [
                { name: "自分で立てる", price: "¥10,000" },
                { name: "公開おまかせ", price: "48,000円", primary: true },
              ],
            },
          }),
        },
        "/portfolio-kit",
      ),
      "Product",
    );
    expect(product?.offers?.price).toBe("48000");
  });

  test("壊れた servicePageConfig でもページは組み上がり、既定の値段に落ちる", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://akieguchi.com", servicePageConfig: "{ not json" },
      "/portfolio-kit",
    );
    expect(nodeOf(out, "Product")?.offers?.price).toBe("30000");
  });

  test("FAQ は設定にある問答から作る", () => {
    const faq = nodeOf(
      injectOgp(
        page,
        {
          siteUrl: "https://akieguchi.com",
          servicePageConfig: JSON.stringify({
            faq: {
              items: [
                { q: "自分のドメインを使えますか？", a: "はい。接続まで行います。" },
                { q: "月額はありますか？", a: "ありません。" },
              ],
            },
          }),
        },
        "/portfolio-kit",
      ),
      "FAQPage",
    );
    expect(faq?.mainEntity).toHaveLength(2);
    expect(faq?.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "自分のドメインを使えますか？",
      acceptedAnswer: { "@type": "Answer", text: "はい。接続まで行います。" },
    });
  });

  test("設定が未保存でも、画面に出ている既定のFAQを構造化データにも出す", () => {
    // 本番で `servicePageConfig` が空のとき、画面は既定のFAQを出しているのに
    // <head> の FAQPage だけ空になっていた（2026-09-01 実測）。
    const faq = nodeOf(
      injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/portfolio-kit"),
      "FAQPage",
    );
    expect(faq?.mainEntity.length).toBeGreaterThan(0);
    expect(JSON.stringify(faq)).toContain("自分のドメインを使えますか？");
  });

  test("英語URLに日本語のFAQは付けない（ページの言語宣言と食い違う）", () => {
    const out = injectOgp(
      page,
      {
        siteUrl: "https://akieguchi.com",
        servicePageConfig: JSON.stringify({
          faq: { items: [{ q: "月額は？", a: "ありません。" }] },
        }),
      },
      "/portfolio-kit/en",
    );
    expect(nodeOf(out, "FAQPage")).toBeUndefined();
    // 値段は言語に関係なく同じものなので、英語側にも出す。
    expect(nodeOf(out, "Product")?.offers?.price).toBe("30000");
  });

  test("配布先のホストでは、屋号入りの画像を Product に名乗らせない", () => {
    const out = injectOgp(
      page,
      { siteUrl: "https://other-site.com", servicePageMode: "on" },
      "/portfolio-kit",
    );
    const product = nodeOf(out, "Product");
    expect(product).toBeDefined();
    expect(product?.image).toBeUndefined();
    expect(product?.offers?.price).toBe("30000");
  });

  test("販売ページでないところに Product を出さない", () => {
    expect(
      nodeOf(injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/"), "Product"),
    ).toBeUndefined();
    expect(
      nodeOf(
        injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/gallery"),
        "Product",
      ),
    ).toBeUndefined();
  });

  test("Work 棚の作品ページにも、Series と同じ構造化データが付く", () => {
    const out = injectOgp(
      page,
      { siteName: "江口秋", siteNameEn: "Aki Eguchi", siteUrl: "https://akieguchi.com" },
      "/work/kyoto",
      "",
      { title: "京都" },
    );
    expect(nodeOf(out, "ImageGallery")).toBeDefined();
    const gallery = graphOf(out).filter((n) => n["@type"] === "ImageGallery");
    expect(gallery.some((n) => n.name === "京都")).toBe(true);
    // 道しるべの2段目は、その1本が実際に置かれている棚を指す。
    expect(nodeOf(out, "BreadcrumbList")?.itemListElement[1]).toMatchObject({
      name: "Work",
      item: "https://akieguchi.com/work",
    });
  });

  test("Series 棚の道しるべは Series のまま", () => {
    const out = injectOgp(
      page,
      { siteNameEn: "Aki Eguchi", siteUrl: "https://akieguchi.com" },
      "/series/indigo",
      "",
      { title: "indigo blue" },
    );
    expect(nodeOf(out, "BreadcrumbList")?.itemListElement[1]).toMatchObject({
      name: "Series",
      item: "https://akieguchi.com/series",
    });
  });
});

describe("injectOgp 撮影依頼の構造化データ", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html lang="ja"><head><title>t</title>
    <meta name="description" content="d" />
    <meta name="author" content="a" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="x" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:url" content="x" />
    <meta property="og:title" content="x" />
    <meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" />
    <meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" />
    </head><body></body></html>`;
  const graphOf = (html: string): Record<string, any>[] => {
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    return m ? JSON.parse(m[1].replace(/\\u003c/g, "<"))["@graph"] : [];
  };
  const nodeOf = (html: string, type: string) =>
    graphOf(html).find((n) => n["@type"] === type);

  const settings = {
    siteName: "江口秋",
    siteNameEn: "Aki Eguchi",
    siteUrl: "https://akieguchi.com",
    contactIntro: "撮影依頼・取材・コラボレーションなど、お気軽にご連絡ください。",
    contactFlow: "ご相談 → 日程と場所のすり合わせ → 撮影 → データ納品。",
  };

  test("撮影を受けるという signal を出す（jobTitle だけでは足りない）", () => {
    const out = injectOgp(page, settings, "/contact");
    const svc = nodeOf(out, "Service");
    expect(svc).toMatchObject({
      "@type": "Service",
      name: "撮影依頼",
      serviceType: "写真撮影",
      provider: { "@type": "Person", name: "江口秋" },
      description: settings.contactIntro,
      termsOfService: settings.contactFlow,
    });
    expect(svc?.availableChannel?.serviceUrl).toBe(
      "https://akieguchi.com/contact",
    );
  });

  test("ContactPage も出す", () => {
    expect(nodeOf(injectOgp(page, settings, "/contact"), "ContactPage")).toMatchObject({
      url: "https://akieguchi.com/contact",
      inLanguage: "ja",
    });
  });

  test("英語URLは英語で名乗り、日本語を混ぜない", () => {
    const out = injectOgp(page, { ...settings, contactIntroEn: "Shoot requests welcome." }, "/en/contact");
    const svc = nodeOf(out, "Service");
    expect(svc?.name).toBe("Photography");
    expect(svc?.description).toBe("Shoot requests welcome.");
    expect(JSON.stringify(svc)).not.toContain("撮影");
    expect(nodeOf(out, "ContactPage")?.inLanguage).toBe("en");
  });

  test("DBに行が無くても、画面に出ている既定の文を Service にも出す", () => {
    // 2026-09-01 に本番で踏んだ食い違い。contactIntro / contactFlow は DB に
    // 行が無く、既定値は API 層だけが持っていた。だから /api/settings には
    // 文が出るのに、同じサイトの構造化データは空だった。
    const svc = nodeOf(
      injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/contact"),
      "Service",
    );
    expect(svc?.description).toContain("撮影依頼");
    expect(svc?.termsOfService).toContain("ご相談");
  });

  test("英語ページは、英語の設定が無ければ文を出さない（日本語を混ぜない）", () => {
    const svc = nodeOf(
      injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/en/contact"),
      "Service",
    );
    expect(svc).toBeDefined();
    expect(svc?.description).toBeUndefined();
    expect(svc?.termsOfService).toBeUndefined();
  });

  test("連絡先ページ以外に Service を出さない", () => {
    for (const p of ["/", "/gallery", "/about", "/portfolio-kit"]) {
      expect(nodeOf(injectOgp(page, settings, p), "Service")).toBeUndefined();
    }
  });

  test("/contact の題が、撮影を頼みたい人の言葉から始まる", () => {
    const out = injectOgp(page, settings, "/contact");
    expect(out).toContain("<title>撮影依頼・お問い合わせ | 江口秋 | Aki Eguchi");
    // 英語URLの題には日本語を出さない。
    expect(injectOgp(page, settings, "/en/contact")).toContain(
      "<title>Contact | 江口秋 | Aki Eguchi",
    );
  });
});

describe("contactAreaNames", () => {
  const { contactAreaNames } =
    require("./ogp") as typeof import("./ogp");

  test("中黒・読点・スラッシュで区切った地名を拾う", () => {
    expect(contactAreaNames("東京・福岡・台北")).toEqual([
      "東京",
      "福岡",
      "台北",
    ]);
    expect(contactAreaNames("東京、福岡、台北")).toEqual([
      "東京",
      "福岡",
      "台北",
    ]);
  });

  test("句点から後ろの但し書きは地名にしない", () => {
    // 「東京・福岡・台北を中心に。その他はご相談ください。」という名前の
    // 場所は存在しない。文を丸ごと1つの Place にしないための守り。
    expect(
      contactAreaNames("東京・福岡・台北を中心に。その他の地域もご相談ください。"),
    ).toEqual(["東京", "福岡", "台北"]);
  });

  test("「を中心に」「周辺」などの飾りを落とす", () => {
    expect(contactAreaNames("東京周辺・福岡など")).toEqual(["東京", "福岡"]);
  });

  test("空・未設定なら何も返さない", () => {
    expect(contactAreaNames("")).toEqual([]);
    expect(contactAreaNames(undefined)).toEqual([]);
    expect(contactAreaNames("。")).toEqual([]);
  });

  test("長すぎる断片は地名として扱わない", () => {
    expect(
      contactAreaNames("お気軽にご連絡いただければどこへでも伺いますのでご相談ください"),
    ).toEqual([]);
  });
});

describe("injectOgp 撮影を受ける地域", () => {
  const { injectOgp } = require("./ogp") as typeof import("./ogp");
  const page = `<html lang="ja"><head><title>t</title>
    <meta name="description" content="d" /><meta name="author" content="a" />
    <meta name="robots" content="index, follow" /><link rel="canonical" href="x" />
    <meta property="og:locale" content="ja_JP" /><meta property="og:url" content="x" />
    <meta property="og:title" content="x" /><meta property="og:description" content="x" />
    <meta property="og:site_name" content="x" /><meta name="twitter:title" content="x" />
    <meta name="twitter:description" content="x" /></head><body></body></html>`;
  const svcOf = (html: string) => {
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    return JSON.parse(m![1].replace(/\\u003c/g, "<"))["@graph"].find(
      (n: any) => n["@type"] === "Service",
    );
  };

  test("地域が Place として出る", () => {
    const svc = svcOf(
      injectOgp(
        page,
        {
          siteUrl: "https://akieguchi.com",
          contactAreas: "東京・福岡・台北を中心に。その他の地域もご相談ください。",
        },
        "/contact",
      ),
    );
    expect(svc.areaServed).toEqual([
      { "@type": "Place", name: "東京" },
      { "@type": "Place", name: "福岡" },
      { "@type": "Place", name: "台北" },
    ]);
  });

  test("設定が空なら areaServed を作らない（無い地域を名乗らない）", () => {
    expect(
      svcOf(injectOgp(page, { siteUrl: "https://akieguchi.com" }, "/contact"))
        .areaServed,
    ).toBeUndefined();
  });
});
