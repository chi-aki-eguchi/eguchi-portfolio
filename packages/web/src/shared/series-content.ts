/** Optional, versioned project copy. Presentation settings and photo originals stay separate. */
export type ContentBlock =
  | { id: string; type: "text"; heading: string; text: string }
  | { id: string; type: "image"; photoId: number | null; caption: string }
  | { id: string; type: "link"; label: string; url: string; description: string }
  | { id: string; type: "facts"; items: { label: string; value: string }[] };
export type SeriesContent = { version: 1; enabled: boolean; blocks: ContentBlock[] };
export const MAX_CONTENT_BLOCKS = 40;
export const EMPTY_SERIES_CONTENT: SeriesContent = { version: 1, enabled: false, blocks: [] };
export function safeContentUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function parseSeriesContent(raw: unknown): SeriesContent | null {
  return parseContent(raw, false);
}
/** Only for local, unfinished editor drafts. Publishing always uses the strict parser. */
export function parseSeriesContentDraft(raw: unknown): SeriesContent | null {
  return parseContent(raw, true);
}
function parseContent(raw: unknown, draft: boolean): SeriesContent | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > (draft ? 1_000_000 : 120_000)) throw new Error("紹介文は120,000文字以内にしてください。");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("紹介文の形式を読み取れません。"); }
  const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  const str = (v: unknown, max: number): string => {
    if (typeof v !== "string" || v.length > max) throw new Error(`入力は${max}文字以内にしてください。`);
    return v;
  };
  if (!obj(value) || value.version !== 1 || typeof value.enabled !== "boolean" || !Array.isArray(value.blocks) || value.blocks.length > MAX_CONTENT_BLOCKS) throw new Error("紹介文の形式または部品数が正しくありません。");
  const ids = new Set<string>();
  const blocks: ContentBlock[] = value.blocks.map((b) => {
    if (!obj(b)) throw new Error("部品の形式が正しくありません。");
    const id = str(b.id, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error("部品の識別子が正しくありません。");
    ids.add(id);
    switch (b.type) {
      case "text": return { id, type: "text", heading: str(b.heading, 200), text: str(b.text, 20_000) };
      case "image": {
        if (b.photoId !== null && (!Number.isSafeInteger(b.photoId) || Number(b.photoId) < 1)) throw new Error("写真を選び直してください。");
        return { id, type: "image", photoId: b.photoId as number | null, caption: str(b.caption, 1000) };
      }
      case "link": {
        const url = str(b.url, 2000);
        if (!draft && url.trim() && !safeContentUrl(url)) throw new Error("リンクは https:// または http:// から始まるURLにしてください。");
        return { id, type: "link", label: str(b.label, 200), url: draft ? url : url.trim(), description: str(b.description, 2000) };
      }
      case "facts": {
        if (!Array.isArray(b.items) || b.items.length > 12) throw new Error("制作情報は12項目以内にしてください。");
        return { id, type: "facts", items: b.items.map((item) => {
          if (!obj(item)) throw new Error("制作情報の形式が正しくありません。");
          return { label: str(item.label, 80), value: str(item.value, 1000) };
        }) };
      }
      default: throw new Error("この部品にはまだ対応していません。");
    }
  });
  return { version: 1, enabled: value.enabled, blocks };
}
/** Fail closed: inactive copy and unavailable photos (including their captions) stay private. */
export function publicSeriesContent(raw: unknown, photoIds: ReadonlySet<number>): string | null {
  try {
    const content = parseSeriesContent(raw);
    if (!content?.enabled) return null;
    return JSON.stringify({ ...content, blocks: content.blocks.filter(b => b.type !== "image" || (b.photoId !== null && photoIds.has(b.photoId))) });
  } catch { return null; }
}
/** Non-image content also qualifies for the public index when there are no photos. */
export function hasTextIntroduction(raw: unknown): boolean {
  try {
    const c = parseSeriesContent(raw);
    return Boolean(c?.enabled && c.blocks.some(b => b.type === "text" ? b.heading.trim() || b.text.trim() : b.type === "link" ? safeContentUrl(b.url) : b.type === "facts" ? b.items.some(i => i.label.trim() && i.value.trim()) : false));
  } catch { return false; }
}
