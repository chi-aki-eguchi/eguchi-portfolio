// Pure note.com RSS parsing — extracted from the API so it can be unit-tested
// without pulling in Hono / the DB / S3. The fetch, cache and failure handling
// stay in the API; this module is string-in → posts-out and never throws.

export type NotePost = { title: string; link: string; date: string; thumbnail: string; excerpt: string };

export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * Parse a note.com RSS feed into a clean post list, in feed order (newest first).
 * Items without a title or link are dropped. The thumbnail is taken from the
 * first available of: <media:thumbnail> (text or url attr), <enclosure url>, or
 * the first <img> in the description.
 */
export function parseNoteRss(xml: string): NotePost[] {
  return xml.split(/<item>/i).slice(1).map((raw) => {
    const block = raw.split(/<\/item>/i)[0];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
      return m ? decodeXml(m[1]).trim() : "";
    };
    const descRaw = get("description");
    const mtText = block.match(/<media:thumbnail[^>]*>([\s\S]*?)<\/media:thumbnail>/i);
    const mtAttr = block.match(/<media:thumbnail[^>]*\burl=["']([^"']+)["']/i);
    const enc = block.match(/<enclosure[^>]*\burl=["']([^"']+)["']/i);
    const imgInDesc = descRaw.match(/<img[^>]+src=["']([^"']+)["']/i);
    const thumbnail =
      (mtText ? decodeXml(mtText[1]).trim() : "") ||
      (mtAttr ? mtAttr[1] : "") ||
      (enc ? enc[1] : "") ||
      (imgInDesc ? imgInDesc[1] : "");
    return {
      title: stripTags(get("title")),
      link: get("link"),
      date: get("pubDate"),
      thumbnail,
      excerpt: stripTags(descRaw).slice(0, 120),
    };
  }).filter((p) => p.title && p.link);
}
