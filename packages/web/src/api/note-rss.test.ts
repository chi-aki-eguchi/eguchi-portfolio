import { describe, test, expect } from "bun:test";
import { decodeXml, stripTags, parseNoteRss, trimExcerpt } from "./note-rss";

describe("decodeXml", () => {
  test("unwraps CDATA and decodes entities", () => {
    expect(decodeXml("<![CDATA[Tom & Jerry]]>")).toBe("Tom & Jerry");
    expect(decodeXml("a &lt;b&gt; &quot;c&quot; &#39;d&#039; &apos;e&apos;")).toBe(`a <b> "c" 'd' 'e'`);
  });

  test("decodes &amp; last so &amp;lt; becomes &lt; not <", () => {
    expect(decodeXml("&amp;lt;")).toBe("&lt;");
  });
});

describe("stripTags", () => {
  test("removes tags and collapses whitespace", () => {
    expect(stripTags("<p>Hello   <b>there</b>\n world</p>")).toBe("Hello there world");
  });
  test("empty / tag-only input yields empty string", () => {
    expect(stripTags("<br/>")).toBe("");
    expect(stripTags("")).toBe("");
  });
});

const item = (inner: string) => `<item>${inner}</item>`;
const feed = (...items: string[]) =>
  `<?xml version="1.0"?><rss><channel>${items.join("")}</channel></rss>`;

describe("parseNoteRss", () => {
  test("parses title/link/date and strips HTML from title & excerpt", () => {
    const xml = feed(item(`
      <title><![CDATA[My <i>First</i> Post]]></title>
      <link>https://note.com/u/n/abc</link>
      <pubDate>Mon, 01 Jan 2024 09:00:00 +0900</pubDate>
      <description><![CDATA[<p>Hello &amp; welcome to the post body.</p>]]></description>
    `));
    const [p] = parseNoteRss(xml);
    expect(p.title).toBe("My First Post");
    expect(p.link).toBe("https://note.com/u/n/abc");
    expect(p.date).toBe("Mon, 01 Jan 2024 09:00:00 +0900");
    expect(p.excerpt).toBe("Hello & welcome to the post body.");
  });

  test("drops items missing a title or link", () => {
    const xml = feed(
      item(`<title>No link</title>`),
      item(`<link>https://note.com/u/n/x</link>`),
      item(`<title>Keeper</title><link>https://note.com/u/n/ok</link>`),
    );
    const posts = parseNoteRss(xml);
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Keeper");
  });

  test("preserves feed order (newest first)", () => {
    const xml = feed(
      item(`<title>One</title><link>https://note.com/u/n/1</link>`),
      item(`<title>Two</title><link>https://note.com/u/n/2</link>`),
      item(`<title>Three</title><link>https://note.com/u/n/3</link>`),
    );
    expect(parseNoteRss(xml).map((p) => p.title)).toEqual(["One", "Two", "Three"]);
  });

  test("empty / itemless feed yields no posts", () => {
    expect(parseNoteRss("")).toEqual([]);
    expect(parseNoteRss(feed())).toEqual([]);
  });

  describe("thumbnail fallback order", () => {
    const withThumb = (thumbBlock: string) =>
      parseNoteRss(feed(item(`<title>T</title><link>https://note.com/u/n/t</link>${thumbBlock}`)))[0].thumbnail;

    test("prefers <media:thumbnail> text content", () => {
      expect(withThumb(`
        <media:thumbnail url="https://img/attr.jpg">https://img/text.jpg</media:thumbnail>
        <enclosure url="https://img/enc.jpg"/>
      `)).toBe("https://img/text.jpg");
    });

    test("falls back to media:thumbnail url attribute when no text", () => {
      expect(withThumb(`<media:thumbnail url="https://img/attr.jpg"/>`)).toBe("https://img/attr.jpg");
    });

    test("falls back to <enclosure url> then to the first <img> in description", () => {
      expect(withThumb(`<enclosure url="https://img/enc.jpg"/>`)).toBe("https://img/enc.jpg");
      expect(withThumb(`<description><![CDATA[<img src="https://img/indesc.jpg"/> body]]></description>`))
        .toBe("https://img/indesc.jpg");
    });

    test("no thumbnail anywhere → empty string", () => {
      expect(withThumb(``)).toBe("");
    });
  });
});

// 2026-09-19: 本番 About の Journal 3件のうち2件が語の途中で切れていた。
test("trimExcerpt ends at a sentence boundary instead of mid-word", () => {
  const body =
    "お待たせいたしました。ほんとに。たいへん（） 先日の67写真たちの続きとして、6×6や6×7の中判フィルム写真を見ていただこうかなと！好きな写真あったらスキしてね！🫶 コメントでこの写真好きです！もお待ちしております どうしてもﾊｯｾﾙﾌﾞﾗｯﾄﾞの話をしたい";
  const out = trimExcerpt(body);
  expect(out.endsWith("どうしてもﾊｯｾﾙﾌ")).toBe(false);
  expect(/[。！？…]$/.test(out)).toBe(true);
  expect(out.length).toBeLessThanOrEqual(121);
});

test("trimExcerpt keeps short text untouched and drops note's own link label", () => {
  expect(trimExcerpt("短い本文です。")).toBe("短い本文です。");
  expect(trimExcerpt("本文です。 続きをみる")).toBe("本文です。");
});

test("trimExcerpt falls back to a soft break with an ellipsis", () => {
  const noPeriod = "あ".repeat(60) + "、" + "い".repeat(80);
  const out = trimExcerpt(noPeriod);
  expect(out.endsWith("…")).toBe(true);
  expect(out.startsWith("あ")).toBe(true);
});

test("trimExcerpt never returns a stub when the first sentence is very short", () => {
  const body = "はい。" + "あ".repeat(200);
  expect(trimExcerpt(body).length).toBeGreaterThan(100);
});

test("trimExcerpt does not stop inside an unclosed bracket", () => {
  const body =
    "お久しぶりです。秋です。 1ヶ月毎日投稿チャレンジ、余裕をもって失敗致しました。悔しい。（ 後で67の写真あるから見てください！ ） 風邪ひいて1回書けなくなって、そのまま「 あぁ、、もうだめだ、、、 」ってなりまして、、、 せめて体調少しよくなってから";
  const out = trimExcerpt(body);
  expect(out).toBe(
    "お久しぶりです。秋です。 1ヶ月毎日投稿チャレンジ、余裕をもって失敗致しました。悔しい。",
  );
});
