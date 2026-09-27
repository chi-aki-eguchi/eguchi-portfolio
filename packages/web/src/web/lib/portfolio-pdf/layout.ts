import type { PortfolioDocument } from "./model";
export type Measure = {
  widthOfTextAtSize: (text: string, size: number) => number;
};
export type PdfIssue = {
  page: number;
  message: string;
  severity: "error" | "warning";
};
export type TextBlock = {
  value: string;
  lines: string[];
  x: number;
  top: number;
  size: number;
  leading: number;
  itemId?: string;
};
export type PhotoBox = {
  id: string;
  x: number;
  top: number;
  width: number;
  height: number;
};
export type Sheet = {
  id: string;
  width: number;
  height: number;
  texts: TextBlock[];
  photos: PhotoBox[];
  issues: PdfIssue[];
};
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: Measure,
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
/** Shared point-based layout for SVG editing and PDF output. No image cropping. */
export type ImageSizes = ReadonlyMap<string, { width: number; height: number }>;
export function layoutBook(
  book: PortfolioDocument,
  font: Measure,
  sizes: ImageSizes = new Map(),
): Sheet[] {
  const [W, H] =
    book.orientation === "portrait" ? [595.276, 841.89] : [841.89, 595.276];
  const M = book.purpose === "photobook" ? 34.016 : 42.52,
    CW = W - 2 * M;
  const sheets: Sheet[] = [];
  const page = (id: string) => {
    const p: Sheet = {
      id,
      width: W,
      height: H,
      texts: [],
      photos: [],
      issues: [],
    };
    sheets.push(p);
    return p;
  };
  const text = (
    p: Sheet,
    value: string,
    x: number,
    top: number,
    width: number,
    maxHeight: number,
    size = 10.5,
    itemId?: string,
  ) => {
    if (!value.trim()) return;
    const lines = wrapText(value, width, size, font),
      leading = size * 1.65;
    if (lines.length * leading > maxHeight) {
      p.issues.push({
        page: sheets.length,
        severity: "error",
        message:
          "文字が枠を超えています。タイトル・説明・プロフィールを短くするか、1枚のページに分けてください",
      });
      return;
    }
    p.texts.push({ value, lines, x, top, size, leading, itemId });
  };
  const measured = (value: string, width: number, size: number) =>
    value.trim() ? wrapText(value, width, size, font).length * size * 1.65 : 0;
  const cover = page("cover");
  const titleH = Math.min(120, measured(book.title, CW, 24));
  const nameH = Math.min(65, measured(book.cover.name, CW, 12));
  text(cover, book.title, M, M, CW, 120, 24);
  text(cover, book.cover.name, M, H - M - nameH, CW, 65, 12);
  if (book.cover.itemId)
    cover.photos.push({
      id: book.cover.itemId,
      x: M,
      top: M + titleH + 28,
      width: CW,
      height: H - 2 * M - titleH - nameH - 56,
    });
  if (!book.title.trim())
    cover.issues.push({
      page: 1,
      severity: "error",
      message: "本の名前を入力してください",
    });
  if (!book.items.length)
    cover.issues.push({
      page: 1,
      severity: "error",
      message: "写真を1枚以上選んでください",
    });
  for (const source of book.pages) {
    const p = page(source.id),
      count = source.itemIds.length;
    const across =
      count === 2 &&
      (source.pairing === "across" ||
        (source.pairing !== "stacked" && book.orientation === "landscape"));
    const gap = 28,
      scale = source.imageScale ?? 1;
    const pageCaptionH = Math.min(60, measured(source.pageCaption, CW, 9));
    // A single image and its page caption form one group. Pair captions sit below both cells.
    const singleCaption = count === 1;
    const bottomSpace = !singleCaption && pageCaptionH ? pageCaptionH + 18 : 0;
    const ratios = source.itemIds.map((id) => {
      const size = sizes.get(id),
        item = book.items.find((i) => i.id === id)!;
      if (!size) return null;
      return item.rotation === 90 || item.rotation === 270
        ? size.height / size.width
        : size.width / size.height;
    });
    const firstWidth =
      across && ratios[0] && ratios[1]
        ? ((CW - gap) * ratios[0]) / (ratios[0] + ratios[1])
        : (CW - gap) / 2;
    const available = H - 2 * M - bottomSpace;
    const bh = count === 2 && !across ? (available - gap) / 2 : available;
    source.itemIds.forEach((id, index) => {
      const item = book.items.find((i) => i.id === id)!;
      const bw = across
        ? index === 0
          ? firstWidth
          : CW - gap - firstWidth
        : CW;
      const cellX = M + (across && index === 1 ? firstWidth + gap : 0);
      const cellTop = M + (count === 2 && !across ? index * (bh + gap) : 0);
      const details =
        book.purpose === "photobook"
          ? ""
          : [
              item.title,
              [item.year, item.technique].filter(Boolean).join(" / "),
              item.captionOverride,
            ]
              .filter(Boolean)
              .join("\n");
      const caption = singleCaption ? source.pageCaption : "";
      const natural = sizes.get(id);
      const maxText = bh * 0.4;
      // Choose a stable text column from the maximum photo width. Capped at 360pt for readable lines.
      const initialFit = natural
        ? fitImage(
            natural.width,
            natural.height,
            bw * scale,
            bh * scale,
            item.rotation,
          )
        : { width: bw * scale, height: bh * scale };
      const textWidth = Math.min(
        bw,
        Math.max(Math.min(240, bw), Math.min(360, initialFit.width)),
      );
      const detailH = Math.min(maxText, measured(details, textWidth, 10.5));
      const extraH = Math.min(60, measured(caption, textWidth, 9));
      const textGap = detailH || extraH ? 14 : 0;
      const interGap = detailH && extraH ? 10 : 0;
      const reserve = detailH + extraH + textGap + interGap;
      const photoH = Math.max(1, (bh - reserve) * scale);
      const fit = natural
        ? fitImage(
            natural.width,
            natural.height,
            bw * scale,
            photoH,
            item.rotation,
          )
        : { width: bw * scale, height: photoH };
      const groupTop = cellTop + (bh - fit.height - reserve) / 2;
      const photoX = cellX + (bw - fit.width) / 2;
      p.photos.push({
        id,
        x: photoX,
        top: groupTop,
        width: fit.width,
        height: fit.height,
      });
      const textX = cellX + (bw - Math.max(fit.width, textWidth)) / 2;
      text(
        p,
        details,
        textX,
        groupTop + fit.height + textGap,
        textWidth,
        detailH,
        10.5,
        id,
      );
      text(
        p,
        caption,
        textX,
        groupTop + fit.height + textGap + detailH + interGap,
        textWidth,
        60,
        9,
      );
    });
    if (!singleCaption)
      text(p, source.pageCaption, M, H - M - pageCaptionH, CW, 60, 9);
  }
  if (book.pdfProfile.enabled) {
    const p = page("profile");
    text(p, "プロフィール", M, M, CW, 40, 18);
    text(p, book.cover.name, M, M + 60, CW, 50, 14);
    text(p, book.pdfProfile.text, M, M + 120, CW, H - 2 * M - 245, 11);
    text(p, book.pdfProfile.contact, M, H - M - 100, CW, 100, 10);
  }
  sheets.forEach(
    (p, n) => n > 0 && text(p, `${n + 1}`, W - M - 12, H - 30, 24, 20, 8),
  );
  return sheets;
}
