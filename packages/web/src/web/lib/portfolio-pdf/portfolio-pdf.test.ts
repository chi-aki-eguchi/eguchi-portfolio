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
