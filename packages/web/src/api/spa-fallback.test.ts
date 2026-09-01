import { describe, expect, test } from "bun:test";
import {
  buildNoscriptFallback,
  injectNoscriptFallback,
  type FallbackInput,
} from "./spa-fallback";
import { publicPageFallbackText } from "./ogp";

const base: FallbackInput = {
  heading: "About — 江口秋",
  description: "江口秋のプロフィールページ。",
  noticeJa: "このサイトの閲覧には JavaScript が必要です。",
  noticeEn: "Please enable JavaScript to view this portfolio.",
};

describe("buildNoscriptFallback", () => {
  test("見出し・本文・リンクを <noscript> の中に出す", () => {
    const out = buildNoscriptFallback({
      ...base,
      paragraphs: ["写真家。京都在住。", "個展を3回。"],
      links: [{ href: "/gallery", label: "Gallery" }],
    });
    expect(out.startsWith("<noscript>")).toBe(true);
    expect(out.endsWith("</noscript>")).toBe(true);
    expect(out).toContain("<h1>About — 江口秋</h1>");
    expect(out).toContain("<p>江口秋のプロフィールページ。</p>");
    expect(out).toContain("<p>写真家。京都在住。</p>");
    expect(out).toContain("<p>個展を3回。</p>");
    expect(out).toContain('<a href="/gallery">Gallery</a>');
  });

  test("JS が要ることを人に伝える一文は残す（そこが <noscript> の本来の役目）", () => {
    const out = buildNoscriptFallback(base);
    expect(out).toContain("このサイトの閲覧には JavaScript が必要です。");
    expect(out).toContain("Please enable JavaScript to view this portfolio.");
  });

  test("空の段落で空の <p> を作らない", () => {
    const out = buildNoscriptFallback({
      ...base,
      description: "",
      paragraphs: ["", "   ", "本文"],
    });
    expect(out).not.toContain("<p></p>");
    expect(out).toContain("<p>本文</p>");
  });

  test("リンクが無ければ <nav> ごと出さない", () => {
    expect(buildNoscriptFallback(base)).not.toContain("<nav>");
  });

  test("設定由来の文字列は必ず逃がす（属性からも本文からも抜け出せない）", () => {
    const out = buildNoscriptFallback({
      ...base,
      heading: '</noscript><script>alert(1)</script>',
      description: 'a" onerror="x',
      links: [{ href: '/x" onclick="y', label: "<b>bold</b>" }],
    });
    expect(out).not.toContain("<script>");
    expect(out).not.toContain('onclick="y');
    expect(out).not.toContain("<b>bold</b>");
    // 閉じタグは末尾の1つだけ — 途中で <noscript> を抜けていない。
    expect(out.match(/<\/noscript>/g)).toHaveLength(1);
  });
});

describe("injectNoscriptFallback", () => {
  const page =
    '<html><body><noscript><div>JavaScript が必要です</div></noscript><div id="root"></div></body></html>';

  test("既存の <noscript> を丸ごと差し替える（二重に増やさない）", () => {
    const out = injectNoscriptFallback(page, base);
    expect(out.match(/<noscript>/g)).toHaveLength(1);
    expect(out).not.toContain("<div>JavaScript が必要です</div>");
    expect(out).toContain("<h1>About — 江口秋</h1>");
  });

  test("#root は触らない（React が最初の描画で捨てる場所に本文を置かない）", () => {
    expect(injectNoscriptFallback(page, base)).toContain('<div id="root"></div>');
  });

  test("<noscript> が無いテンプレートでも落とさず素通しする", () => {
    const bare = "<html><body><div id=\"root\"></div></body></html>";
    expect(injectNoscriptFallback(bare, base)).toBe(bare);
  });
});

describe("publicPageFallbackText", () => {
  const settings = {
    siteName: "江口秋",
    siteNameEn: "Aki Eguchi",
    siteUrl: "https://akieguchi.com",
  };

  test("プロフィールは profileBio を段落ごとに渡す（唯一まとまった文章があるページ）", () => {
    const text = publicPageFallbackText(
      { ...settings, profileBio: "写真家。京都在住。\n\n個展を3回。" },
      "/about",
    );
    expect(text.paragraphs).toEqual(["写真家。京都在住。", "個展を3回。"]);
  });

  test("/profile は /about と同じ文を返す（同じページなので）", () => {
    const bio = { ...settings, profileBio: "写真家。" };
    expect(publicPageFallbackText(bio, "/profile").paragraphs).toEqual(
      publicPageFallbackText(bio, "/about").paragraphs,
    );
  });

  test("シリーズの詳細は、その1本の題と statement を返す", () => {
    const text = publicPageFallbackText(settings, "/work/kyoto", {
      title: "京都",
      desc: "2024年の京都。",
    });
    expect(text.heading).toBe("京都");
    expect(text.description).toBe("2024年の京都。");
  });

  test("statement が空のシリーズでも、題を名乗る文になる", () => {
    const text = publicPageFallbackText(settings, "/series/indigo", {
      title: "indigo blue",
    });
    expect(text.heading).toBe("indigo blue");
    expect(text.description).toContain("indigo blue");
  });

  test("説明は管理画面の設定を優先し、無ければそのページ用の文に落ちる", () => {
    expect(
      publicPageFallbackText(
        { ...settings, metaDescriptionGallery: "手で書いた説明。" },
        "/gallery",
      ).description,
    ).toBe("手で書いた説明。");
    expect(publicPageFallbackText(settings, "/gallery").description).toContain(
      "ギャラリー",
    );
  });

  test("販売ページの見出しは題の前半だけ（`|` の後ろは説明の語）", () => {
    const text = publicPageFallbackText(settings, "/portfolio-kit");
    expect(text.heading).toBe("写真を置く場所をつくる");
    expect(text.description).toContain("¥30,000");
  });

  test("トップの見出しは名前そのもの", () => {
    expect(publicPageFallbackText(settings, "/").heading).toBe("江口秋");
  });
});

describe("撮影依頼と販売の言葉が HTML に出ているか", () => {
  const settings = {
    siteName: "江口秋",
    siteNameEn: "Aki Eguchi",
    siteUrl: "https://akieguchi.com",
    contactIntro: "撮影依頼・取材・コラボレーションなど、お気軽にご連絡ください。",
    contactFlow: "ご相談 → 日程と場所のすり合わせ → 撮影 → データ納品、という流れです。",
    contactNote: "「まだ決まっていないけれど相談したい」という段階でも歓迎です。",
    contactIntroEn: "For shoot requests, interviews, or collaborations.",
    contactFlowEn: "Consultation, scheduling, the shoot, then delivery.",
  };

  test("/contact に、依頼の入口・流れ・但し書きが出る", () => {
    const text = publicPageFallbackText(settings, "/contact");
    expect(text.paragraphs).toEqual([
      settings.contactIntro,
      settings.contactFlow,
      settings.contactNote,
    ]);
  });

  test("/en/contact は英語の設定を使い、日本語を混ぜない", () => {
    const text = publicPageFallbackText(settings, "/en/contact");
    expect(text.paragraphs).toEqual([
      settings.contactIntroEn,
      settings.contactFlowEn,
    ]);
    expect(text.paragraphs.join("")).not.toContain("撮影依頼");
  });

  test("設定が空でも段落を作らない（空の <p> を並べない）", () => {
    expect(
      publicPageFallbackText({ siteName: "江口秋" }, "/contact").paragraphs,
    ).toEqual([]);
  });

  test("販売ページには、プランに含まれるものが出る", () => {
    const text = publicPageFallbackText(
      {
        ...settings,
        servicePageConfig: JSON.stringify({
          pricing: {
            plans: [
              {
                name: "公開おまかせ",
                sub: "設定はすべてこちらで行います。",
                points: ["独自ドメインの取得を一緒に行う", "初期設定して納品"],
              },
            ],
          },
        }),
      },
      "/portfolio-kit",
    );
    expect(text.paragraphs).toEqual([
      "公開おまかせ：設定はすべてこちらで行います。",
      "独自ドメインの取得を一緒に行う",
      "初期設定して納品",
    ]);
  });

  test("販売ページの設定が未保存・壊れていても、画面と同じ既定のプランを出す", () => {
    // FAQ・値段と同じ扱い。**画面は既定値を描いているのにサーバだけ空**という
    // 食い違いを作らない（2026-09-01、FAQ で実際にそうなっていた）。
    for (const cfg of ["{ not json", ""]) {
      const p = publicPageFallbackText(
        { ...settings, servicePageConfig: cfg },
        "/portfolio-kit",
      ).paragraphs;
      expect(p.length).toBeGreaterThan(0);
      expect(p.join(" ")).toContain("独自ドメイン");
    }
  });
});
