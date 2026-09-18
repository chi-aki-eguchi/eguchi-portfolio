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

/** note.com が説明文の末尾に付ける自前のリンク文言。作者が書いた文ではない。 */
const FEED_BOILERPLATE = /(?:\s*続きをみる)+\s*$/;

/**
 * 抜粋を「文の終わり」で切る。
 *
 * 以前は 120 文字でそのまま切っていたので、本番の About の Journal は
 * 「どうしてもﾊｯｾﾙﾌ」のように語の途中で終わっていた（2026-09-19 実測、
 * 3件中2件）。作者の文は書き換えず、**どこで止めるか**だけを変える。
 *
 *  - 上限までの間に句点があれば、その文の終わりで止める（…は付けない）。
 *  - 開いたままの括弧で終わるときは、閉じている手前の文まで下げる。
 *  - 句点が早すぎる位置にしか無ければ読点・空白まで下げ、「…」で続きを示す。
 *  - どちらも無ければ従来どおり上限で切り、「…」を付ける。
 */
export function trimExcerpt(text: string, max = 120): string {
  const body = text.replace(FEED_BOILERPLATE, "").trim();
  if (body.length <= max) return body;
  const head = body.slice(0, max);
  // 短すぎる抜粋（1文字目の直後の句点など）にしないための下限。
  const floor = Math.floor(max * 0.4);
  const ends: number[] = [];
  for (let i = 0; i < head.length; i++) {
    if ("。．！？!?".includes(head[i])) ends.push(i + 1);
  }
  const usable = ends.filter((i) => i >= floor);
  // 開いたままの括弧・鉤括弧で終える切り方は避ける。「（ 後で見てください！」の
  // ように、続きがあるのに閉じない一文になる。少し短くなっても、閉じている
  // ところで止めるほうが読める。ただし短すぎる抜粋にはしない。
  const balanced = ends.filter(
    (i) => i >= Math.floor(floor / 2) && isBalanced(body.slice(0, i)),
  );
  const last = (xs: number[]) => (xs.length > 0 ? xs[xs.length - 1] : undefined);
  const cut = last(usable) ?? last(balanced);
  const preferred =
    cut !== undefined && !isBalanced(body.slice(0, cut))
      ? (last(balanced) ?? cut)
      : cut;
  if (preferred !== undefined) return body.slice(0, preferred);
  const soft = Math.max(
    head.lastIndexOf("、"),
    head.lastIndexOf("，"),
    head.lastIndexOf(" "),
    head.lastIndexOf("\u3000"),
  );
  if (soft >= floor) return `${body.slice(0, soft + 1).trim()}…`;
  return `${head.trim()}…`;
}

const BRACKET_PAIRS: Record<string, string> = {
  "（": "）",
  "(": ")",
  "「": "」",
  "『": "』",
  "【": "】",
  "［": "］",
  "[": "]",
};

/** 開いた括弧がすべて閉じているか。入れ子の種類までは見ない（抜粋には十分）。 */
function isBalanced(text: string): boolean {
  const stack: string[] = [];
  for (const ch of text) {
    if (BRACKET_PAIRS[ch]) stack.push(BRACKET_PAIRS[ch]);
    else if (Object.values(BRACKET_PAIRS).includes(ch)) {
      if (stack[stack.length - 1] === ch) stack.pop();
      else return false;
    }
  }
  return stack.length === 0;
}

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
      excerpt: trimExcerpt(stripTags(descRaw)),
    };
  }).filter((p) => p.title && p.link);
}
