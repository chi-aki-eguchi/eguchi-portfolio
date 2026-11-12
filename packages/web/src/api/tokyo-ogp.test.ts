import { describe, expect, test } from "bun:test";
import { injectOgp, publicPageFallbackText } from "./ogp";
import { TOKYO_SHOOT, formatYen } from "../shared/tokyo-shoot";

/**
 * 東京の撮影プラン（/tokyo）が、サーバーの出す HTML でも言語ごとに正しく名乗ること。
 * 画面は SPA が描くので、題・言語・robots の間違いはブラウザで開いても気づけない。
 */
describe("injectOgp /tokyo（東京の撮影プラン）", () => {
  const page = `<html lang="ja"><head><title>t</title>
<meta name="description" content="d">
<meta name="author" content="a">
<meta name="robots" content="index, follow">
<meta property="og:locale" content="ja_JP">
<link rel="canonical" href="c">
</head><body></body></html>`;
  const owner = { siteUrl: "https://akieguchi.com", siteName: "江口秋", siteNameEn: "Aki Eguchi", heroSubtitle: "写真学生" };
  const buyer = { siteUrl: "https://example.com", siteName: "山田", siteNameEn: "Yamada" };
  const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];
  const descOf = (html: string) => html.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? "";

  test("繁體中文のページは zh-Hant を名乗り、題と説明も繁體中文", () => {
    const out = injectOgp(page, owner, "/tokyo");
    expect(out).toContain('<html lang="zh-Hant"');
    expect(out).toContain('property="og:locale" content="zh_TW"');
    expect(titleOf(out)).toBe("東京旅拍｜中文攝影師・底片人像 | 江口秋 | Aki Eguchi");
    expect(descOf(out)).toContain("東京旅拍");
    expect(descOf(out)).toContain(formatYen(Math.min(...TOKYO_SHOOT.plans.map((p) => p.priceYen))));
    expect(out).toContain('rel="canonical" href="https://akieguchi.com/tokyo"');
    expect(out).not.toContain("noindex");
  });

  test("英語のページは英語だけの題と説明、日本語のページは今までの題の形", () => {
    const en = injectOgp(page, owner, "/tokyo/en");
    expect(en).toContain('<html lang="en"');
    expect(titleOf(en)).toBe("Tokyo Portrait Photographer | Film &amp; Digital Sessions | Aki Eguchi");
    expect(descOf(en)).not.toMatch(/[぀-ヿ一-鿿]/);
    const ja = injectOgp(page, owner, "/tokyo/ja");
    expect(ja).toContain('<html lang="ja"');
    expect(titleOf(ja)).toBe("東京での撮影プラン｜旅行中のポートレート・フィルム撮影 | 江口秋 | Aki Eguchi | 写真学生");
  });

  test("3言語のページが互いを指す", () => {
    for (const path of ["/tokyo", "/tokyo/en", "/tokyo/ja"]) {
      const out = injectOgp(page, owner, path);
      expect(out).toContain('hreflang="zh-Hant" href="https://akieguchi.com/tokyo"');
      expect(out).toContain('hreflang="en" href="https://akieguchi.com/tokyo/en"');
      expect(out).toContain('hreflang="ja" href="https://akieguchi.com/tokyo/ja"');
    }
  });

  test("Portfolio Kit を買った人のサイトでは無いページ（Not Found・noindex・言語も変えない）", () => {
    const out = injectOgp(page, buyer, "/tokyo");
    expect(titleOf(out)).toContain("Not Found");
    expect(out).toContain("noindex");
    expect(out).toContain('<html lang="ja"');
    expect(out).not.toContain('hreflang="zh-Hant"');
  });

  test("検索側が読める形でも、プランと料金・地域・対応する言語を名乗る（オーナーのサイトだけ）", () => {
    const ld = (html: string) =>
      [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
        const data = JSON.parse(m[1]!);
        return (data["@graph"] ?? [data]) as Record<string, any>[];
      });
    const service = ld(injectOgp(page, owner, "/tokyo")).find((node) => node["@type"] === "Service");
    expect(service?.inLanguage).toBe("zh-Hant");
    expect(service?.areaServed?.name).toBe("Tokyo");
    expect(service?.offers.map((o: any) => o.price)).toEqual(TOKYO_SHOOT.plans.map((p) => String(p.priceYen)));
    expect(service?.offers.every((o: any) => o.priceCurrency === "JPY")).toBe(true);
    expect(ld(injectOgp(page, buyer, "/tokyo")).some((node) => node["@type"] === "Service")).toBe(false);
  });

  test("JavaScript を動かさない読み手にも、その言語でプランと料金が届く", () => {
    const text = publicPageFallbackText(owner, "/tokyo");
    expect(text.heading).toBe("東京旅拍");
    const body = text.paragraphs.join("\n");
    for (const plan of TOKYO_SHOOT.plans) expect(body).toContain(formatYen(plan.priceYen));
    expect(publicPageFallbackText(owner, "/tokyo/en").paragraphs.join("\n")).not.toMatch(/[぀-ヿ一-鿿]/);
  });
});
