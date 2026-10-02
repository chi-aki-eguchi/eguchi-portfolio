export type SourcePhoto = {
  id: number;
  sourceAssetReference: string;
  title: string;
  description: string;
  rotation: number;
  isPublished: boolean;
};
export type Item = {
  id: string;
  sourcePhotoId: number;
  sourceAssetReference: string;
  metadataSnapshot: { title: string; description: string };
  title: string;
  year: string;
  technique: string;
  captionOverride: string;
  rotation: number;
  placement: "contain";
};
export type BookPage = {
  id: string;
  layout: "one" | "two";
  itemIds: string[];
  pageCaption: string;
  imageScale?: number;
  pairing?: "auto" | "across" | "stacked";
};
export type PortfolioDocument = {
  schemaVersion: 1;
  templateVersion: 3;
  purpose: "submission" | "photobook";
  id: string;
  title: string;
  updatedAt: string;
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  cover: { name: string; itemId: string | null };
  pdfProfile: { enabled: boolean; text: string; contact: string };
  /** 写真集の最後に作品一覧を載せるか（無い・true なら載せる）。2026-10-02 追加。 */
  plateList?: boolean;
  items: Item[];
  pages: BookPage[];
};
export const STORAGE_KEY = "portfolio-pdf.v1.books";
export const createBook = (): PortfolioDocument => ({
  schemaVersion: 1,
  templateVersion: 3,
  purpose: "submission",
  id: crypto.randomUUID(),
  title: "新しい作品集",
  updatedAt: new Date().toISOString(),
  pageSize: "A4",
  orientation: "portrait",
  cover: { name: "", itemId: null },
  pdfProfile: { enabled: false, text: "", contact: "" },
  items: [],
  pages: [],
});
export function addPhoto(
  book: PortfolioDocument,
  p: SourcePhoto,
): PortfolioDocument {
  if (book.items.length >= 20) throw new Error("この試作は写真20枚までです");
  if (book.items.some((i) => i.sourcePhotoId === p.id)) return book;
  const item: Item = {
    id: crypto.randomUUID(),
    sourcePhotoId: p.id,
    sourceAssetReference: p.sourceAssetReference,
    metadataSnapshot: { title: p.title, description: p.description },
    title: p.title,
    captionOverride: p.description,
    year: "",
    technique: "",
    rotation: p.rotation || 0,
    placement: "contain",
  };
  return {
    ...book,
    items: [...book.items, item],
    pages: [
      ...book.pages,
      {
        id: crypto.randomUUID(),
        layout: "one",
        itemIds: [item.id],
        pageCaption: "",
      },
    ],
  };
}
export function removeItem(
  book: PortfolioDocument,
  id: string,
): PortfolioDocument {
  return {
    ...book,
    cover: {
      ...book.cover,
      itemId: book.cover.itemId === id ? null : book.cover.itemId,
    },
    items: book.items.filter((i) => i.id !== id),
    pages: book.pages
      .map((p) => ({ ...p, itemIds: p.itemIds.filter((x) => x !== id) }))
      .filter((p) => p.itemIds.length),
  };
}
export function movePage(
  book: PortfolioDocument,
  index: number,
  delta: number,
): PortfolioDocument {
  const pages = [...book.pages],
    target = index + delta;
  if (target < 0 || target >= pages.length) return book;
  pages.splice(target, 0, ...pages.splice(index, 1));
  return { ...book, pages };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 8000): v is string =>
  typeof v === "string" &&
  v.length <= max &&
  !Array.from(v).some((c) => c.charCodeAt(0) < 32 && c !== "\n" && c !== "\r");
/** Imports are data, never fetch instructions. Strict validation before showing any content. */
export function parseBook(raw: unknown): PortfolioDocument {
  const fail = () => {
    throw new Error("対応していない、または壊れた作品集ファイルです");
  };
  if (!object(raw)) return fail();
  if (
    raw.schemaVersion !== 1 ||
    ![1, 2, 3].includes(Number(raw.templateVersion)) ||
    typeof raw.templateVersion !== "number" ||
    (raw.purpose !== undefined &&
      !["submission", "photobook"].includes(String(raw.purpose))) ||
    raw.pageSize !== "A4" ||
    !["portrait", "landscape"].includes(String(raw.orientation)) ||
    !str(raw.id, 100) ||
    !str(raw.title, 500) ||
    !str(raw.updatedAt, 100)
  )
    return fail();
  if (
    !object(raw.cover) ||
    !str(raw.cover.name, 500) ||
    !(raw.cover.itemId === null || str(raw.cover.itemId, 100))
  )
    return fail();
  if (
    !object(raw.pdfProfile) ||
    typeof raw.pdfProfile.enabled !== "boolean" ||
    !str(raw.pdfProfile.text) ||
    !str(raw.pdfProfile.contact, 2000) ||
    (raw.plateList !== undefined && typeof raw.plateList !== "boolean")
  )
    return fail();
  if (
    !Array.isArray(raw.items) ||
    raw.items.length > 20 ||
    !Array.isArray(raw.pages) ||
    raw.pages.length > 22
  )
    return fail();
  const ids = new Set<string>();
  for (const i of raw.items) {
    if (
      !object(i) ||
      !str(i.id, 100) ||
      ids.has(i.id) ||
      !Number.isSafeInteger(i.sourcePhotoId) ||
      Number(i.sourcePhotoId) <= 0 ||
      !str(i.sourceAssetReference, 2000) ||
      !str(i.title, 500) ||
      !str(i.year, 100) ||
      !str(i.technique, 500) ||
      !str(i.captionOverride) ||
      ![0, 90, 180, 270].includes(Number(i.rotation)) ||
      typeof i.rotation !== "number" ||
      i.placement !== "contain" ||
      !object(i.metadataSnapshot) ||
      !str(i.metadataSnapshot.title, 500) ||
      !str(i.metadataSnapshot.description)
    )
      return fail();
    ids.add(i.id);
  }
  const used = new Set<string>(),
    pageIds = new Set<string>();
  for (const p of raw.pages) {
    if (
      !object(p) ||
      !str(p.id, 100) ||
      pageIds.has(p.id) ||
      !["one", "two"].includes(String(p.layout)) ||
      !str(p.pageCaption, 2000) ||
      (p.imageScale !== undefined &&
        ![0.7, 0.85, 1].includes(p.imageScale as number)) ||
      (p.pairing !== undefined &&
        !["auto", "across", "stacked"].includes(p.pairing as string)) ||
      !Array.isArray(p.itemIds) ||
      p.itemIds.length < 1 ||
      p.itemIds.length > (p.layout === "one" ? 1 : 2)
    )
      return fail();
    pageIds.add(p.id);
    for (const id of p.itemIds) {
      if (typeof id !== "string" || !ids.has(id) || used.has(id)) return fail();
      used.add(id);
    }
  }
  if (
    used.size !== ids.size ||
    (raw.cover.itemId !== null && !ids.has(raw.cover.itemId))
  )
    return fail();
  // Re-serialize drops prototypes; no URL from this file is ever fetched.
  return {
    ...JSON.parse(JSON.stringify(raw)),
    templateVersion: 3,
    purpose: raw.purpose ?? "submission",
  } as PortfolioDocument;
}
/**
 * 写真集の作品一覧に載せる作品と、そのページ番号（2026-10-02）。写真集は作品のページに
 * 文字を載せないので、作品名・制作年・技法を最後にまとめる（写真集のふつうの作り）。
 * どれも入っていない作品は載せない。提出用は各ページに載るので一覧は作らない。
 */
export function plateEntries(b: PortfolioDocument) {
  if (b.purpose !== "photobook" || b.plateList === false) return [];
  return b.pages.flatMap((p, n) =>
    p.itemIds.flatMap((id) => {
      const item = b.items.find((i) => i.id === id);
      return item && [item.title, item.year, item.technique].some((v) => v.trim())
        ? [{ page: n + 2, item }]
        : [];
    }),
  );
}
export const pageCount = (b: PortfolioDocument) =>
  1 + b.pages.length + Number(plateEntries(b).length > 0) + Number(b.pdfProfile.enabled);

/**
 * 保存する PDF の名前（2026-10-02）。受け取った人の手元で誰の何か分かるよう、氏名を先に。
 * 送信用は「江口秋_光のあと.pdf」、印刷用は「江口秋_光のあと_印刷用.pdf」。
 * 以前は「光のあと-送信用.pdf」で、氏名が無く「送信用」はこちらの言葉だった。
 */
export function pdfFileName(book: PortfolioDocument, quality: "screen" | "print") {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const parts = [clean(book.cover.name), clean(book.title) || "作品集"].filter(Boolean);
  if (quality === "print") parts.push("印刷用");
  return `${Array.from(parts.join("_")).slice(0, 100).join("")}.pdf`;
}

/** Independent copy, including page/item references; source photos remain shared read-only. */
export function duplicateBook(book: PortfolioDocument): PortfolioDocument {
  const copy = parseBook(book);
  const ids = new Map(copy.items.map((i) => [i.id, crypto.randomUUID()]));
  return {
    ...copy,
    id: crypto.randomUUID(),
    title: `${copy.title.slice(0, 490)} のコピー`,
    updatedAt: new Date().toISOString(),
    cover: {
      ...copy.cover,
      itemId: copy.cover.itemId ? ids.get(copy.cover.itemId)! : null,
    },
    items: copy.items.map((i) => ({ ...i, id: ids.get(i.id)! })),
    pages: copy.pages.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      itemIds: p.itemIds.map((id) => ids.get(id)!),
    })),
  };
}
