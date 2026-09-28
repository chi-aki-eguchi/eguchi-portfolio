import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseBook, type PortfolioDocument } from "./model";
import { layoutBook, fitImage, type PdfIssue } from "./layout";
export { fitImage, wrapText } from "./layout";
export type { PdfIssue } from "./layout";
export type PdfAsset = { id: string; bytes: Uint8Array };
export type PdfResult = {
  bytes: Uint8Array | null;
  pageCount: number;
  issues: PdfIssue[];
};

async function normalizeCffSubsetHeaders(pdf: PDFDocument): Promise<void> {
  await pdf.flush();
  // @pdf-lib/fontkit 1.1.1 CFFSubset writes cff.length into offSize.
  // CFF 1.0 requires 1..4 (Adobe Technical Note 5176, sections 3 and 6).
  // Correct only that header byte, keeping every glyph and INDEX offset intact.
  for (const [ref, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) ||
        object.dict.get(PDFName.of("Subtype")) !== PDFName.of("CIDFontType0C")) continue;
    const bytes = decodePDFRawStream(object).decode();
    if (bytes.length < 4 || bytes[0] !== 1 || bytes[1] !== 0 || bytes[2] !== 4 ||
        (bytes[3] >= 1 && bytes[3] <= 4)) continue;
    const corrected = bytes.slice();
    corrected[3] = 4;
    const entries = object.dict.entries().filter(([key]) =>
      !["Length", "Filter", "DecodeParms"].includes(key.decodeText()));
    pdf.context.assign(ref, pdf.context.flateStream(corrected,
      Object.fromEntries(entries.map(([key, value]) => [key.decodeText(), value]))));
  }
}
export async function renderPortfolio(
  bookInput: PortfolioDocument,
  assets: PdfAsset[],
  fontBytes: Uint8Array,
  progress: (done: number, total: number) => void = () => {},
): Promise<PdfResult> {
  const book = parseBook(bookInput);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const images = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  for (const a of assets) images.set(a.id, await pdf.embedJpg(a.bytes));
  const sheets = layoutBook(book, font, images),
    issues = sheets.flatMap((p) => p.issues);
  for (const [n, sheet] of sheets.entries()) {
    const p = pdf.addPage([sheet.width, sheet.height]);
    for (const t of sheet.texts) {
      if (
        Array.from(t.value).some(
          (c) => c !== "\n" && c !== "\r" && !supported.has(c.codePointAt(0)!),
        )
      ) {
        issues.push({
          page: n + 1,
          severity: "error",
          message:
            "日本語フォントにない文字があります。絵文字・特殊文字を置き換えてください",
        });
        continue;
      }
      t.lines.forEach((line, i) =>
        p.drawText(line, {
          x: t.x,
          y: sheet.height - t.top - t.size - i * t.leading,
          size: t.size,
          font,
          color: rgb(0.13, 0.13, 0.13),
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
      if (fit.dpi < 200)
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
  pdf.setTitle(book.title);
  pdf.setCreator("Portfolio Kit PDF v3");
  pdf.setProducer("Portfolio Kit");
  if (!issues.some((i) => i.severity === "error")) await normalizeCffSubsetHeaders(pdf);
  return {
    bytes: issues.some((i) => i.severity === "error") ? null : await pdf.save(),
    pageCount: pdf.getPageCount(),
    issues,
  };
}
