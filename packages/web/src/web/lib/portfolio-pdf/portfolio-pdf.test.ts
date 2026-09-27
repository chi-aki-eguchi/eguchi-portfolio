import { describe, test, expect } from "bun:test";
import { PDFDocument } from "pdf-lib";
import {
  addPhoto,
  createBook,
  movePage,
  parseBook,
  removeItem,
  type SourcePhoto,
} from "./model";
import { fitImage, renderPortfolio, wrapText } from "./render";
import { readFileSync } from "node:fs";
import sharp from "sharp";
const source: SourcePhoto = {
  id: 1,
  sourceAssetReference: "/api/images/photos/test.jpg",
  title: "光と影",
  description: "日本語と English、句読点。",
  rotation: 90,
  isPublished: false,
};
const make = () => addPhoto(createBook(), source);
const font = new Uint8Array(
  readFileSync(
    new URL(
      "../../../../public/fonts/pdf/NotoSansJP-Regular.otf",
      import.meta.url,
    ),
  ),
);
const jpeg = await sharp({
  create: { width: 800, height: 600, channels: 3, background: "#9a8877" },
})
  .jpeg()
  .toBuffer();
describe("PDF作品集の分離と読み戻し", () => {
  test("コピーした説明、制作年、非公開状態と元の順番を分離する", () => {
    const original = JSON.stringify(source);
    let b = make();
    b.items[0].captionOverride = "PDF専用";
    b.items[0].year = "2026";
    b = addPhoto(b, { ...source, id: 2 });
    b = movePage(b, 1, -1);
    expect(JSON.stringify(source)).toBe(original);
    expect(b.items[1].year).toBe("");
    expect(parseBook(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(b.pages[0].itemIds).toEqual([b.items[1].id]);
  });
  test("表紙写真を外すと参照と空ページも消える", () => {
    let b = make();
    b.cover.itemId = b.items[0].id;
    b = removeItem(b, b.items[0].id);
    expect(b.cover.itemId).toBeNull();
    expect(b.pages).toHaveLength(0);
  });
  test("不正な版・重複・欠落・過大データ・回転を拒否する", () => {
    for (const edit of [
      (b: any) => (b.schemaVersion = 2),
      (b: any) => b.pages[0].itemIds.push(b.items[0].id),
      (b: any) => (b.pages = []),
      (b: any) => (b.items[0].sourcePhotoId = -1),
      (b: any) => (b.items[0].rotation = "90"),
      (b: any) => (b.pdfProfile.text = "a".repeat(9000)),
    ]) {
      const b = make();
      edit(b);
      expect(() => parseBook(b)).toThrow();
    }
  });
  test("20枚制限", () => {
    let b = createBook();
    for (let i = 1; i <= 20; i++) b = addPhoto(b, { ...source, id: i });
    expect(() => addPhoto(b, { ...source, id: 21 })).toThrow();
  });
});
describe("PDFの実物", () => {
  test("回転後の比率を保ち、実埋め込み寸法からdpiを求める", () => {
    const fit = fitImage(1600, 800, 400, 600, 90);
    expect(fit.width).toBe(300);
    expect(fit.height).toBe(600);
    expect(fit.dpi).toBe(192);
  });
  test("改行と長い日本語を文字欠落なく折り返す", () => {
    const text = "長い日本語の作品名ABC、句読点。";
    const lines = wrapText(text, 30, 10, {
      widthOfTextAtSize: (s) => Array.from(s).length * 10,
    });
    expect(lines.join("")).toBe(text);
    expect(lines.every((s) => s.length <= 3)).toBe(true);
  });
  test("縦横A4・全ページと実際のバイトを読み戻せる", async () => {
    for (const orientation of ["portrait", "landscape"] as const) {
      const b = make();
      b.orientation = orientation;
      b.pdfProfile = {
        enabled: true,
        text: "写真の記録です。",
        contact: "連絡先は任意です。",
      };
      const r = await renderPortfolio(
        b,
        [{ id: b.items[0].id, bytes: jpeg }],
        font,
      );
      expect(r.bytes).not.toBeNull();
      const pdf = await PDFDocument.load(r.bytes!);
      expect(pdf.getPageCount()).toBe(3);
      expect(pdf.getPages()[0].getWidth()).toBeCloseTo(
        orientation === "portrait" ? 595.276 : 841.89,
        2,
      );
      expect(r.issues.some((i) => i.severity === "error")).toBe(false);
    }
  });
  test("長文・文字欠落・画像不足はPDF成功にしない", async () => {
    for (const kind of ["overflow", "glyph", "missing"]) {
      const b = make();
      if (kind === "overflow")
        b.items[0].captionOverride = "長い説明。".repeat(400);
      if (kind === "glyph") b.title = "写真📷";
      const r = await renderPortfolio(
        b,
        kind === "missing" ? [] : [{ id: b.items[0].id, bytes: jpeg }],
        font,
      );
      expect(r.bytes).toBeNull();
      expect(r.issues.some((i) => i.severity === "error")).toBe(true);
    }
  });
});

describe("本を見ながら整える", () => {
  test("旧文書を移行し、複製は元の説明と参照を壊さない", async () => {
    const { duplicateBook } = await import("./model");
    const b = make();
    b.cover.itemId = b.items[0].id;
    const old: any = JSON.parse(JSON.stringify(b));
    delete old.purpose;
    old.templateVersion = 1;
    expect(parseBook(old).purpose).toBe("submission");
    expect(parseBook(old).templateVersion).toBe(3);
    const copy = duplicateBook(b);
    expect(parseBook(copy)).toEqual(copy);
    expect(copy.id).not.toBe(b.id);
    expect(copy.items[0].id).not.toBe(b.items[0].id);
    expect(copy.cover.itemId).toBe(copy.items[0].id);
    copy.items[0].captionOverride = "複製だけの説明";
    expect(b.items[0].captionOverride).toBe(source.description);
    expect(copy.items[0].sourcePhotoId).toBe(b.items[0].sourcePhotoId);
    expect(() => parseBook({ ...b, purpose: "unknown" })).toThrow();
  });
  test("ドラッグしたページを挿入し、中間の順序を保つ", () => {
    let b = make();
    for (let id = 2; id <= 4; id++) b = addPhoto(b, { ...source, id });
    const ids = b.pages.map((p) => p.id);
    expect(movePage(b, 0, 3).pages.map((p) => p.id)).toEqual([
      ids[1],
      ids[2],
      ids[3],
      ids[0],
    ]);
    expect(b.pages.map((p) => p.id)).toEqual(ids);
  });
  test("空欄の枠をなくし、文章の分だけ写真を縮め、写真集でも説明を保持", async () => {
    const { layoutBook } = await import("./layout");
    const measure = {
      widthOfTextAtSize: (s: string, size: number) => s.length * size,
    };
    const b = make();
    b.items[0].title = "";
    b.items[0].captionOverride = "";
    const empty = layoutBook(b, measure)[1].photos[0];
    b.items[0].captionOverride = "説明";
    const short = layoutBook(b, measure)[1].photos[0];
    expect(empty.height - short.height).toBeCloseTo(10.5 * 1.65 + 14);
    b.items[0].captionOverride = "説明\n二行目\n三行目";
    const longer = layoutBook(b, measure)[1].photos[0];
    expect(short.height - longer.height).toBeCloseTo(2 * 10.5 * 1.65);
    b.purpose = "photobook";
    const photo = layoutBook(b, measure)[1];
    expect(photo.photos[0].height).toBeGreaterThan(empty.height);
    expect(photo.texts.some((t) => t.value.includes("説明"))).toBe(false);
    expect(b.items[0].captionOverride).toContain("三行目");
  });
});

test("実画像の縦横比で写真と説明をまとめ、余白と2枚組を保持する", async () => {
  const { layoutBook } = await import("./layout");
  const measure = {
    widthOfTextAtSize: (s: string, size: number) => s.length * size,
  };
  let b = make();
  b.items[0].rotation = 0;
  const sizes = new Map([[b.items[0].id, { width: 2000, height: 1000 }]]);
  const sheet = layoutBook(b, measure, sizes)[1];
  const photo = sheet.photos[0],
    caption = sheet.texts[0];
  expect(photo.width / photo.height).toBeCloseTo(2);
  expect(caption.top - photo.top - photo.height).toBeCloseTo(14);
  expect(caption.top + caption.lines.length * caption.leading).toBeLessThan(
    sheet.height - 42,
  );
  b.pages[0].imageScale = 0.7;
  expect(layoutBook(b, measure, sizes)[1].photos[0].width).toBeCloseTo(
    photo.width * 0.7,
  );
  b = addPhoto(b, { ...source, id: 2 });
  b.pages[0] = {
    ...b.pages[0],
    layout: "two",
    itemIds: b.items.map((i) => i.id),
    pairing: "across",
  };
  b.pages.pop();
  expect(parseBook(b)).toEqual(b);
  const pair = layoutBook(b, measure, sizes)[1].photos;
  expect(pair[1].x).toBeGreaterThan(pair[0].x + pair[0].width);
  expect(() =>
    parseBook({ ...b, pages: [{ ...b.pages[0], imageScale: 4 }] }),
  ).toThrow();
});

test("縦横の2枚組は切り抜かず同じ高さでそろえる", async () => {
  const { layoutBook } = await import("./layout");
  let b = addPhoto(make(), { ...source, id: 2 });
  b.purpose = "photobook";
  b.orientation = "landscape";
  b.items.forEach((i) => (i.rotation = 0));
  b.pages = [
    {
      ...b.pages[0],
      layout: "two",
      itemIds: b.items.map((i) => i.id),
      pairing: "across",
    },
  ];
  const sizes = new Map([
    [b.items[0].id, { width: 1000, height: 1600 }],
    [b.items[1].id, { width: 1600, height: 1000 }],
  ]);
  const sheet = layoutBook(
    b,
    { widthOfTextAtSize: (s) => s.length * 10 },
    sizes,
  )[1];
  expect(sheet.photos[0].height).toBeCloseTo(sheet.photos[1].height);
  expect(sheet.photos[0].top).toBeCloseTo(sheet.photos[1].top);
  expect(sheet.photos[0].width / sheet.photos[0].height).toBeCloseTo(
    1000 / 1600,
  );
  expect(sheet.photos[1].width / sheet.photos[1].height).toBeCloseTo(
    1600 / 1000,
  );
});
