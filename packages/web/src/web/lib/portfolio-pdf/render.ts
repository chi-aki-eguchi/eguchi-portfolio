import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseBook, type PortfolioDocument } from "./model";
export type PdfAsset = { id: string; bytes: Uint8Array };
export type PdfIssue = {
  page: number;
  message: string;
  severity: "error" | "warning";
};
export type PdfResult = {
  bytes: Uint8Array | null;
  pageCount: number;
  issues: PdfIssue[];
};
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: Pick<PDFFont, "widthOfTextAtSize">,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
export function fitImage(
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
  rotation: number,
) {
  const swapped = rotation === 90 || rotation === 270;
  const w = swapped ? height : width,
    h = swapped ? width : height;
  const scale = Math.min(boxWidth / w, boxHeight / h);
  return { width: w * scale, height: h * scale, scale, dpi: 72 / scale };
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
  const issues: PdfIssue[] = [];
  const [W, H] =
    book.orientation === "portrait" ? [595.276, 841.89] : [841.89, 595.276];
  const M = 42.52,
    CW = W - M * 2;
  const total = 1 + book.pages.length + Number(book.pdfProfile.enabled);
  const images = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
  for (const a of assets) images.set(a.id, await pdf.embedJpg(a.bytes));
  let number = 0;
  const page = () => {
    const p = pdf.addPage([W, H]);
    number++;
    p.drawText(`${number} / ${total}`, {
      x: W - M - 36,
      y: 22,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    progress(number, total);
    return p;
  };
  const text = (
    p: PDFPage,
    value: string,
    x: number,
    top: number,
    width: number,
    maxHeight: number,
    size = 10.5,
  ) => {
    if (!value) return;
    if (
      Array.from(value).some(
        (c) => c !== "\n" && c !== "\r" && !supported.has(c.codePointAt(0)!),
      )
    ) {
      issues.push({
        page: number,
        severity: "error",
        message:
          "日本語フォントにない文字があります。絵文字・特殊文字を置き換えてください",
      });
      return;
    }
    const lines = wrapText(value, width, size, font),
      leading = size * 1.65;
    if (lines.length * leading > maxHeight) {
      issues.push({
        page: number,
        severity: "error",
        message:
          "文字が枠を超えています。タイトル・説明・プロフィールを短くするか、1枚のページに分けてください",
      });
      return;
    }
    lines.forEach((line, i) =>
      p.drawText(line, {
        x,
        y: H - top - size - i * leading,
        size,
        font,
        color: rgb(0.13, 0.13, 0.13),
      }),
    );
  };
  const photo = (
    p: PDFPage,
    id: string,
    x: number,
    top: number,
    width: number,
    height: number,
  ) => {
    const image = images.get(id),
      item = book.items.find((i) => i.id === id);
    if (!image || !item) {
      issues.push({
        page: number,
        severity: "error",
        message: "画像が欠落しています",
      });
      return;
    }
    const r = item.rotation,
      fit = fitImage(image.width, image.height, width, height, r);
    if (fit.dpi < 200)
      issues.push({
        page: number,
        severity: "warning",
        message: `印刷解像度 ${Math.round(fit.dpi)} dpi（目安200 dpi以上）。保存画像 ${image.width} × ${image.height} px`,
      });
    const left = x + (width - fit.width) / 2,
      bottom = H - top - height + (height - fit.height) / 2;
    // Document rotation is clockwise; PDF coordinates rotate counterclockwise.
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
  };
  const cover = page();
  text(cover, book.title, M, M, CW, 100, 24);
  text(cover, book.cover.name, M, H - M - 45, CW, 45, 12);
  if (book.cover.itemId)
    photo(cover, book.cover.itemId, M, M + 120, CW, H - 2 * M - 200);
  if (!book.title.trim())
    issues.push({
      page: 1,
      severity: "error",
      message: "本の名前を入力してください",
    });
  if (!book.items.length)
    issues.push({
      page: 1,
      severity: "error",
      message: "写真を1枚以上選んでください",
    });
  for (const sheet of book.pages) {
    const p = page(),
      count = sheet.itemIds.length;
    const twoAcross = count === 2 && book.orientation === "landscape";
    const gap = 24;
    const bw = twoAcross ? (CW - gap) / 2 : CW;
    const bh =
      count === 2 && !twoAcross ? (H - 2 * M - 44 - gap) / 2 : H - 2 * M - 44;
    sheet.itemIds.forEach((id, index) => {
      const item = book.items.find((i) => i.id === id)!;
      const x = M + (twoAcross ? index * (bw + gap) : 0);
      const top = M + (count === 2 && !twoAcross ? index * (bh + gap) : 0);
      const captionH = count === 2 ? 94 : 142;
      photo(p, id, x, top, bw, bh - captionH - 16);
      const details = [
        item.title,
        [item.year, item.technique].filter(Boolean).join(" / "),
        item.captionOverride,
      ]
        .filter(Boolean)
        .join("\n");
      text(p, details, x, top + bh - captionH, bw, captionH);
    });
    text(p, sheet.pageCaption, M, H - M - 30, CW, 30, 9);
  }
  if (book.pdfProfile.enabled) {
    const p = page();
    text(p, "プロフィール", M, M, CW, 40, 18);
    text(p, book.cover.name, M, M + 60, CW, 50, 14);
    text(p, book.pdfProfile.text, M, M + 120, CW, H - 2 * M - 245, 11);
    text(p, book.pdfProfile.contact, M, H - M - 100, CW, 100, 10);
  }
  pdf.setTitle(book.title);
  pdf.setCreator("Portfolio Kit PDF v1");
  pdf.setProducer("Portfolio Kit");
  return {
    bytes: issues.some((i) => i.severity === "error") ? null : await pdf.save(),
    pageCount: pdf.getPageCount(),
    issues,
  };
}
