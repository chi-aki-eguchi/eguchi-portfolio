import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseBook, type PortfolioDocument } from "./model";
import { layoutBook, fitImage, TONE_RGB, type Measure, type PdfIssue } from "./layout";
import { subsetFont } from "./font-subset";
export { fitImage, wrapText } from "./layout";
export type { PdfIssue } from "./layout";
export type PdfAsset = { id: string; bytes: Uint8Array };
export type PdfResult = {
  bytes: Uint8Array | null;
  pageCount: number;
  issues: PdfIssue[];
};
export type RenderOptions = {
  /** 送信用（screen）は画面で見る前提なので、印刷解像度の注意を出さない。 */
  quality?: "screen" | "print";
  /** harfbuzz-subset.wasm。あればフォントを使う文字だけに減らす。 */
  subsetWasm?: Uint8Array;
};
export async function renderPortfolio(
  bookInput: PortfolioDocument,
  assets: PdfAsset[],
  fontBytes: Uint8Array,
  progress: (done: number, total: number) => void = () => {},
  options: RenderOptions = {},
): Promise<PdfResult> {
  const book = parseBook(bookInput);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // 組版（文字幅・折り返し）は元のフォントで測る。埋め込むのは減らした物でも、
  // 字幅は同じなので位置は変わらない。
  const full = fontkit.create(fontBytes);
  const measure: Measure = {
    widthOfTextAtSize: (value, size) =>
      (full.layout(value).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) /
        full.unitsPerEm) *
      size,
  };
  const images = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  for (const a of assets) images.set(a.id, await pdf.embedJpg(a.bytes));
  const sheets = layoutBook(book, measure, images),
    issues = sheets.flatMap((p) => p.issues);
  const drawable = sheets.map((sheet, n) =>
    sheet.texts.filter((t) => {
      const missing = Array.from(t.value).some(
        (c) => c !== "\n" && c !== "\r" && !full.hasGlyphForCodePoint(c.codePointAt(0)!),
      );
      if (missing)
        issues.push({
          page: n + 1,
          severity: "error",
          message:
            "日本語フォントにない文字があります。絵文字・特殊文字を置き換えてください",
        });
      return !missing;
    }),
  );
  // 使う文字だけのフォントを作る。作れない・欠けるときは元のフォントを丸ごと入れる。
  let embedBytes = fontBytes;
  if (options.subsetWasm) {
    const used = new Set(drawable.flat().flatMap((t) => t.lines.flatMap((l) => Array.from(l))));
    try {
      const subset = await subsetFont(fontBytes, used, options.subsetWasm);
      const check = fontkit.create(subset);
      if ([...used].every((c) => check.hasGlyphForCodePoint(c.codePointAt(0)!)))
        embedBytes = subset;
    } catch {
      // 元のフォントで続ける（ファイルが大きくなるだけで、見た目は同じ）。
    }
  }
  // fontkit のサブセット化は日本語の字形を壊すので使わない（subset: false）。
  const font = await pdf.embedFont(embedBytes, { subset: false });
  for (const [n, sheet] of sheets.entries()) {
    const p = pdf.addPage([sheet.width, sheet.height]);
    for (const t of drawable[n]) {
      const [r, g, b] = TONE_RGB[t.tone];
      t.lines.forEach((line, i) =>
        p.drawText(line, {
          x: t.x,
          y: sheet.height - t.top - t.size - i * t.leading,
          size: t.size,
          font,
          color: rgb(r, g, b),
        }),
      );
    }
    for (const box of sheet.photos) {
      const image = images.get(box.id),
        item = book.items.find((i) => i.id === box.id);
      if (!image || !item) {
        issues.push({
          page: n + 1,
          severity: "error",
          message: "画像が欠落しています",
        });
        continue;
      }
      const r = item.rotation,
        fit = fitImage(image.width, image.height, box.width, box.height, r);
      if (options.quality !== "screen" && fit.dpi < 200)
        issues.push({
          page: n + 1,
          severity: "warning",
          message: `印刷解像度 ${Math.round(fit.dpi)} dpi（目安200 dpi以上）。保存画像 ${image.width} × ${image.height} px`,
        });
      const left = box.x + (box.width - fit.width) / 2,
        bottom =
          sheet.height - box.top - box.height + (box.height - fit.height) / 2;
      const offsets =
        r === 90
          ? [0, fit.height]
          : r === 180
            ? [fit.width, fit.height]
            : r === 270
              ? [fit.width, 0]
              : [0, 0];
      p.drawImage(image, {
        x: left + offsets[0],
        y: bottom + offsets[1],
        width: image.width * fit.scale,
        height: image.height * fit.scale,
        rotate: degrees(-r),
      });
    }
    progress(n + 1, sheets.length);
  }
  // 開いたときの窓の名前をファイル名ではなく本の名前に。作者・言語も入れる。
  pdf.setTitle(book.title, { showInWindowTitleBar: true });
  if (book.cover.name.trim()) pdf.setAuthor(book.cover.name.trim());
  pdf.setLanguage("ja-JP");
  pdf.setCreator("Portfolio Kit PDF v4");
  pdf.setProducer("Portfolio Kit");
  return {
    bytes: issues.some((i) => i.severity === "error") ? null : await pdf.save(),
    pageCount: pdf.getPageCount(),
    issues,
  };
}
