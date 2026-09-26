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
};
export type PortfolioDocument = {
  schemaVersion: 1;
  templateVersion: 1;
  id: string;
  title: string;
  updatedAt: string;
  pageSize: "A4";
  orientation: "portrait" | "landscape";
  cover: { name: string; itemId: string | null };
  pdfProfile: { enabled: boolean; text: string; contact: string };
  items: Item[];
  pages: BookPage[];
};
export const STORAGE_KEY = "portfolio-pdf.v1.books";
export const createBook = (): PortfolioDocument => ({
  schemaVersion: 1,
  templateVersion: 1,
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
  [pages[index], pages[target]] = [pages[target], pages[index]];
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
    raw.templateVersion !== 1 ||
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
    !str(raw.pdfProfile.contact, 2000)
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
  return JSON.parse(JSON.stringify(raw)) as PortfolioDocument;
}
export const pageCount = (b: PortfolioDocument) =>
  1 + b.pages.length + Number(b.pdfProfile.enabled);
