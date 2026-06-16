import { describe, test, expect } from "bun:test";
import { decodeXml, stripTags, parseNoteRss } from "./note-rss";

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
