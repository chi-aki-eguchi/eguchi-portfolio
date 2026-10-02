import { PDFDocument, PDFHexString, PDFName, PDFString, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseBook, type PortfolioDocument } from "./model";
import {
  layoutBook,
  fitImage,
  TONE_RGB,
  type Measure,
  type PdfIssue,
  type Sheet,
  type TextBlock,
} from "./layout";
import { subsetFont } from "./font-subset";
export { fitImage, wrapText } from "./layout";
export type { PdfIssue } from "./layout";
export type PdfAsset = { id: string; bytes: Uint8Array };
export type PdfResult = {
  bytes: Uint8Array | null;
  pageCount: number;
  issues: PdfIssue[];
};
// 文中のメールアドレスと URL。PDF の上で押すと、メール・ブラウザーが開く（2026-10-02）。
const LINK =
  /https?:\/\/[^\s　、。，「」『』（）()<>"']+|www\.[^\s　、。，「」『』（）()<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
export type TextLink = { line: number; start: number; end: number; uri: string };
/** 文の中のリンクを、組んだ行ごとの位置（行の中の文字の範囲）にして返す。行をまたぐ URL も1つの宛先。 */
export function textLinks(t: Pick<TextBlock, "value" | "lines">): TextLink[] {
  const found: { start: number; end: number; uri: string }[] = [];
  for (const m of t.value.matchAll(LINK)) {
    const text = m[0].replace(/[.,;:!?]+$/, "");
    let uri = `mailto:${text}`;
    if (!text.includes("@") || /^(https?:|www\.)/.test(text)) {
      // 日本語のドメインや道筋は、ブラウザーと同じ決まりで ASCII に直す。直せない物は押せるようにしない。
      try {
        uri = new URL(text.startsWith("www.") ? `https://${text}` : text).href;
      } catch {
        continue;
      }
    }
    found.push({ start: m.index!, end: m.index! + text.length, uri });
  }
  if (!found.length) return [];
  // 行は文の一続きの部分（行の境目の空白・改行だけが落ちる）なので、前から順に探せる。
  const out: TextLink[] = [];
  let pos = 0;
  t.lines.forEach((line, i) => {
    const from = line ? t.value.indexOf(line, pos) : pos;
    if (from < 0) return;
    const to = from + line.length;
    pos = to;
    for (const f of found) {
      const a = Math.max(f.start, from),
        b = Math.min(f.end, to);
      if (a < b) out.push({ line: i, start: a - from, end: b - from, uri: f.uri });
    }
  });
  return out;
}
const pdfLiteral = (value: string) =>
  PDFString.of(value.replace(/[\\()]/g, (c) => `\\${c}`));

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
      const baseline = (i: number) => sheet.height - t.top - t.size - i * t.leading;
      t.lines.forEach((line, i) =>
        p.drawText(line, {
          x: t.x,
          y: baseline(i),
          size: t.size,
          font,
          color: rgb(r, g, b),
        }),
      );
      for (const link of textLinks(t)) {
        const line = t.lines[link.line];
        const x0 = t.x + measure.widthOfTextAtSize(line.slice(0, link.start), t.size);
        const x1 = t.x + measure.widthOfTextAtSize(line.slice(0, link.end), t.size);
        const y = baseline(link.line);
        const annot = pdf.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x0, y - t.size * 0.3, x1, y + t.size * 0.9],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: pdfLiteral(link.uri) },
        });
        p.node.addAnnot(pdf.context.register(annot));
      }
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
  addOutline(pdf, sheets, book);
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

/**
 * しおり（目次）。プレビューや Acrobat の横の一覧から、表紙・作品・プロフィールへ飛べる。
 * 提出用は作品名（無ければページ番号）、写真集は文字を載せない本なのでページ番号だけ。
 */
function addOutline(pdf: PDFDocument, sheets: Sheet[], book: PortfolioDocument) {
  if (!sheets.length) return;
  const label = (sheet: Sheet, n: number) => {
    if (n === 0) return "表紙";
    if (sheet.id === "profile") return "プロフィール";
    const source = book.pages.find((p) => p.id === sheet.id);
    const titles =
      book.purpose === "photobook"
        ? []
        : (source?.itemIds ?? [])
            .map((id) => book.items.find((i) => i.id === id)?.title.trim() ?? "")
            .filter(Boolean);
    return titles.length ? titles.join(" / ") : `${n + 1}ページ`;
  };
  const outline = pdf.context.nextRef();
  const refs = sheets.map(() => pdf.context.nextRef());
  sheets.forEach((sheet, n) => {
    pdf.context.assign(
      refs[n],
      pdf.context.obj({
        Title: PDFHexString.fromText(label(sheet, n)),
        Parent: outline,
        Dest: [pdf.getPage(n).ref, "Fit"],
        ...(n > 0 ? { Prev: refs[n - 1] } : {}),
        ...(n < refs.length - 1 ? { Next: refs[n + 1] } : {}),
      }),
    );
  });
  pdf.context.assign(
    outline,
    pdf.context.obj({
      Type: "Outlines",
      First: refs[0],
      Last: refs[refs.length - 1],
      Count: refs.length,
    }),
  );
  pdf.catalog.set(PDFName.of("Outlines"), outline);
}
