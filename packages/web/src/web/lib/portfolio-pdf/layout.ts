import type { PortfolioDocument } from "./model";
import { hasJapanese, jaPhrases } from "../ja-phrases";
export type Measure = {
  widthOfTextAtSize: (text: string, size: number) => number;
};
export type PdfIssue = {
  page: number;
  message: string;
  severity: "error" | "warning";
};
/** 文字の濃さ。墨・控えめ・かすか（ページ番号や柱）の3段。 */
export type Tone = "ink" | "quiet" | "faint";
export const TONE_RGB: Record<Tone, readonly [number, number, number]> = {
  ink: [0.11, 0.11, 0.11],
  quiet: [0.4, 0.4, 0.4],
  faint: [0.58, 0.58, 0.58],
};
export type TextBlock = {
  value: string;
  lines: string[];
  x: number;
  top: number;
  size: number;
  leading: number;
  tone: Tone;
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

/**
 * 文字の大きさ（pt）と行送り（2026-10-02 組み直し）。
 *
 * 以前は表紙の題 24pt と、作品名・制作年・説明をすべて 10.5pt の同じ黒で
 * 組んでいて、作品集というより書類に見えた。作品名だけを墨で、制作年や説明は
 * 一段小さく控えめに。表紙は題を大きく、名前を小さく。
 */
export const TYPE = {
  coverTitle: 26,
  coverName: 11,
  captionTitle: 9.5,
  captionMeta: 8.5,
  captionText: 8.5,
  pageCaption: 9,
  profileLabel: 9,
  profileName: 16,
  profileBody: 10,
  profileContact: 9.5,
  folio: 8,
  running: 7.5,
} as const;
export const LEADING = { title: 1.3, caption: 1.75, body: 1.85, single: 1.5 } as const;
/** 写真と説明のあいだ。 */
export const CAPTION_GAP = 12;
/** 説明の行の長さ。広い写真の下でも、読める長さ（8.5pt で約35字）に止める。 */
const CAPTION_MAX_WIDTH = 300;
const CAPTION_MIN_WIDTH = 200;

// ── 日本語の折り返し ──────────────────────────────────────
// 行頭に来てはいけない文字（句読点・閉じ括弧・小書きのかな・長音など）と、
// 行末に残してはいけない文字（開き括弧）。句読点だけは行末にぶら下げる。
const NO_START = new Set(
  Array.from(
    "、。，．・：；？！ー…‥」』）］｝〕〉》】〙〗〟’”ゝゞ々ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ),.:;?!%",
  ),
);
const HANG = new Set(Array.from("、。，．,."));
const NO_END = new Set(Array.from("「『（［｛〔〈《【〘〖〝‘“([{"));

function tokens(paragraph: string): string[] {
  // 日本語は文節（BudouX）、欧文は語（空白の後ろで切る）。
  if (hasJapanese(paragraph)) return jaPhrases(paragraph);
  return paragraph.split(/(?<= )/);
}

/**
 * 文節の切れ目で折り返す（2026-10-02）。以前は1文字ずつ詰めていたので、
 * 「デジタ／ル」と語の途中で割れ、行頭に「。」が来ることもあった。
 * 1つの文節が1行に入らないときだけ文字の途中で折り、そのときも禁則を守る。
 */
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: Measure,
): string[] {
  const fits = (s: string) => font.widthOfTextAtSize(s.trimEnd(), size) <= width;
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    const out: string[] = [];
    let line = "";
    const breakLong = (s: string) => {
      for (const char of Array.from(s)) {
        if (line && !fits(line + char)) {
          // 句読点は行末にぶら下げる。
          if (HANG.has(char)) {
            line += char;
            continue;
          }
          let carry = "";
          const chars = Array.from(line);
          // 行頭に置けない字（ー・ッ・」など）は、前の字と一緒に次の行へ。
          if (NO_START.has(char) && chars.length > 1) carry = chars.pop()!;
          // 行末に開き括弧を残さない。
          while (chars.length > 1 && NO_END.has(chars[chars.length - 1])) carry = chars.pop()! + carry;
          out.push(chars.join(""));
          line = carry;
        }
        line += char;
      }
    };
    for (const token of tokens(paragraph)) {
      if (line && fits(line + token)) {
        line += token;
        continue;
      }
      if (line) out.push(line.trimEnd());
      line = "";
      const next = token.trimStart();
      if (fits(next)) line = next;
      else breakLong(next);
    }
    out.push(line.trimEnd());
    // 文節の頭が行頭禁則の文字になったら、その字は前の行の末へ。
    for (let i = 1; i < out.length; i++) {
      while (out[i] && NO_START.has(Array.from(out[i])[0])) {
        const chars = Array.from(out[i]);
        out[i - 1] += chars.shift();
        out[i] = chars.join("");
      }
    }
    lines.push(...out.filter((l, i) => l !== "" || i === 0));
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
type Run = { value: string; size: number; leading: number; tone: Tone; gapBefore: number };

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
  const overflow = (p: Sheet) =>
    p.issues.push({
      page: sheets.indexOf(p) + 1,
      severity: "error",
      message:
        "文字が枠を超えています。タイトル・説明・プロフィールを短くするか、1枚のページに分けてください",
    });
  const linesOf = (value: string, width: number, size: number) =>
    value.trim() ? wrapText(value, width, size, font) : [];
  // 複数の段（作品名・制作年・説明など）の高さ。空の段は場所を取らない。
  const runsHeight = (runs: Run[], width: number) => {
    let h = 0,
      first = true;
    for (const r of runs) {
      const n = linesOf(r.value, width, r.size).length;
      if (!n) continue;
      h += (first ? 0 : r.gapBefore) + n * r.size * r.leading;
      first = false;
    }
    return h;
  };
  const placeRuns = (
    p: Sheet,
    runs: Run[],
    x: number,
    top: number,
    width: number,
    itemId?: string,
  ) => {
    let y = top,
      first = true;
    for (const r of runs) {
      const lines = linesOf(r.value, width, r.size);
      if (!lines.length) continue;
      if (!first) y += r.gapBefore;
      p.texts.push({
        value: r.value,
        lines,
        x,
        top: y,
        size: r.size,
        leading: r.size * r.leading,
        tone: r.tone,
        itemId,
      });
      y += lines.length * r.size * r.leading;
      first = false;
    }
    return y;
  };
  const ratioOf = (id: string) => {
    const size = sizes.get(id),
      item = book.items.find((i) => i.id === id);
    if (!size || !item) return null;
    return item.rotation === 90 || item.rotation === 270
      ? { width: size.height, height: size.width }
      : size;
  };

  // ── 表紙: 写真と、その下に題と名前をひとまとまりで ──────────
  const cover = page("cover");
  const coverRuns: Run[] = [
    { value: book.title, size: TYPE.coverTitle, leading: LEADING.title, tone: "ink", gapBefore: 0 },
    { value: book.cover.name, size: TYPE.coverName, leading: LEADING.single, tone: "quiet", gapBefore: 12 },
  ];
  // 題と名前に使える高さ。超えたら置かずに知らせる（写真は小さくしない）。
  const coverCap = (H - 2 * M) * 0.4;
  const coverPhoto = book.cover.itemId
    ? book.items.find((i) => i.id === book.cover.itemId)
    : undefined;
  if (coverPhoto) {
    const gap = 26;
    let textWidth = CW,
      fit = { width: CW, height: 0 };
    // 題の幅は写真の幅に合わせる。幅が決まると題の行数が決まり、写真の高さが決まる。
    for (let k = 0; k < 3; k++) {
      const blockH = Math.min(coverCap, runsHeight(coverRuns, textWidth));
      const boxH = Math.max(1, H - 2 * M - (blockH ? blockH + gap : 0));
      const natural = ratioOf(coverPhoto.id);
      fit = natural
        ? fitImage(natural.width, natural.height, CW, boxH, 0)
        : { width: CW, height: boxH };
      const next = Math.max(Math.min(CW, 240), fit.width);
      if (Math.abs(next - textWidth) < 0.5) break;
      textWidth = next;
    }
    const blockH = runsHeight(coverRuns, textWidth);
    if (blockH > coverCap) overflow(cover);
    const shownH = blockH > coverCap ? 0 : blockH;
    const groupH = fit.height + (shownH ? gap + shownH : 0);
    const top = M + Math.max(0, (H - 2 * M - groupH) / 2);
    const x = M + (CW - fit.width) / 2;
    cover.photos.push({ id: coverPhoto.id, x, top, width: fit.width, height: fit.height });
    if (shownH) placeRuns(cover, coverRuns, x, top + fit.height + gap, textWidth);
  } else {
    // 写真の無い表紙は、題を紙の上から4割ほどの所に。
    const blockH = runsHeight(coverRuns, CW);
    if (blockH > coverCap) overflow(cover);
    else placeRuns(cover, coverRuns, M, Math.min(H * 0.38, H - M - blockH), CW);
  }
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

  // ── 作品のページ ─────────────────────────────────────
  for (const source of book.pages) {
    const p = page(source.id),
      count = source.itemIds.length;
    const across =
      count === 2 &&
      (source.pairing === "across" ||
        (source.pairing !== "stacked" && book.orientation === "landscape"));
    const gap = 28,
      scale = source.imageScale ?? 1;
    const pageCaption: Run = {
      value: source.pageCaption,
      size: TYPE.pageCaption,
      leading: LEADING.caption,
      tone: "quiet",
      gapBefore: 10,
    };
    // 1枚のページは写真と説明をひとまとまりに。2枚のページの説明は下にまとめる。
    const singleCaption = count === 1;
    const pageCaptionH = Math.min(60, runsHeight([pageCaption], CW));
    const bottomSpace = !singleCaption && pageCaptionH ? pageCaptionH + 18 : 0;
    const ratios = source.itemIds.map((id) => {
      const r = ratioOf(id);
      return r ? r.width / r.height : null;
    });
    const firstWidth =
      across && ratios[0] && ratios[1]
        ? ((CW - gap) * ratios[0]) / (ratios[0] + ratios[1])
        : (CW - gap) / 2;
    const available = H - 2 * M - bottomSpace;
    const bh = count === 2 && !across ? (available - gap) / 2 : available;
    const runsFor = (id: string): Run[] => {
      const item = book.items.find((i) => i.id === id)!;
      const runs: Run[] =
        book.purpose === "photobook"
          ? []
          : [
              { value: item.title, size: TYPE.captionTitle, leading: LEADING.single, tone: "ink", gapBefore: 0 },
              {
                value: [item.year, item.technique].filter(Boolean).join(" / "),
                size: TYPE.captionMeta,
                leading: LEADING.single,
                tone: "quiet",
                gapBefore: 1,
              },
              { value: item.captionOverride, size: TYPE.captionText, leading: LEADING.caption, tone: "quiet", gapBefore: 6 },
            ];
      if (singleCaption) runs.push(pageCaption);
      return runs;
    };
    const cell = (index: number) => ({
      x: M + (across && index === 1 ? firstWidth + gap : 0),
      top: M + (count === 2 && !across ? index * (bh + gap) : 0),
      width: across ? (index === 0 ? firstWidth : CW - gap - firstWidth) : CW,
    });
    // 説明に使える高さ。超えたら置かずに知らせる（写真は小さくしすぎない）。
    const captionCap = bh * 0.4;
    type Plan = {
      id: string;
      c: ReturnType<typeof cell>;
      runs: Run[];
      natural: { width: number; height: number } | null;
      reserve: number;
      fit: { width: number; height: number };
      photoX: number;
      textWidth: number;
    };
    // 説明に reserve の高さを取ったときの写真の大きさと、説明の幅。
    // 幅は写真の幅から決め（狭すぎず、長すぎず）、写真の左端にそろえる。
    const solve = (q: Plan, reserve: number) => {
      const photoH = Math.max(1, (bh - reserve) * scale);
      q.fit = q.natural
        ? fitImage(q.natural.width, q.natural.height, q.c.width * scale, photoH, 0)
        : { width: q.c.width * scale, height: photoH };
      q.photoX = q.c.x + (q.c.width - q.fit.width) / 2;
      q.textWidth = Math.min(
        Math.max(Math.min(q.fit.width, CAPTION_MAX_WIDTH), Math.min(CAPTION_MIN_WIDTH, q.c.width)),
        q.c.x + q.c.width - q.photoX,
      );
      q.reserve = reserve;
    };
    const need = (q: Plan) => {
      const h = runsHeight(q.runs, q.textWidth);
      return h ? Math.min(captionCap, h) + CAPTION_GAP : 0;
    };
    const plan = source.itemIds.map((id, index) => {
      const q: Plan = {
        id,
        c: cell(index),
        runs: runsFor(id),
        natural: ratioOf(id),
        reserve: 0,
        fit: { width: 0, height: 0 },
        photoX: 0,
        textWidth: 0,
      };
      solve(q, 0);
      return q;
    });
    // 説明の高さ→写真の大きさ→説明の幅→…を数回でそろえる（説明は増える一方なので止まる）。
    // 横に並べた2枚は、説明の長さが違っても同じ高さを取り、写真の上端と高さをそろえる。
    for (let k = 0; k < 6; k++) {
      const needs = plan.map(need);
      const targets = across ? needs.map(() => Math.max(...needs)) : needs;
      if (plan.every((q, i) => Math.abs(targets[i] - q.reserve) < 0.5)) break;
      plan.forEach((q, i) => solve(q, targets[i]));
    }
    for (const q of plan) {
      if (runsHeight(q.runs, q.textWidth) > captionCap) {
        overflow(p);
        q.runs = [];
      }
      // 1枚の写真は、紙の真ん中よりわずかに上に置く（目に見える中心）。
      const lift = singleCaption ? 0.46 : 0.5;
      const groupTop = q.c.top + Math.max(0, (bh - q.fit.height - q.reserve) * lift);
      p.photos.push({ id: q.id, x: q.photoX, top: groupTop, width: q.fit.width, height: q.fit.height });
      if (q.runs.length)
        placeRuns(p, q.runs, q.photoX, groupTop + q.fit.height + CAPTION_GAP, q.textWidth, q.id);
    }
    if (!singleCaption && pageCaptionH) {
      const lines = linesOf(source.pageCaption, CW, TYPE.pageCaption);
      if (lines.length * TYPE.pageCaption * LEADING.caption > 60) overflow(p);
      else placeRuns(p, [pageCaption], M, H - M - pageCaptionH, CW);
    }
  }

  // ── プロフィール: 見出し・名前・文・連絡先をひと続きに ─────────
  if (book.pdfProfile.enabled) {
    const p = page("profile");
    const width = Math.min(CW, 380);
    const runs: Run[] = [
      { value: "プロフィール", size: TYPE.profileLabel, leading: LEADING.single, tone: "faint", gapBefore: 0 },
      { value: book.cover.name, size: TYPE.profileName, leading: LEADING.title, tone: "ink", gapBefore: 14 },
      { value: book.pdfProfile.text, size: TYPE.profileBody, leading: LEADING.body, tone: "ink", gapBefore: 18 },
      { value: book.pdfProfile.contact, size: TYPE.profileContact, leading: LEADING.caption, tone: "quiet", gapBefore: 24 },
    ];
    const h = runsHeight(runs, width);
    if (h > H - 2 * M) overflow(p);
    else placeRuns(p, runs, M, M, width);
  }

  // ── ページ番号と柱（下の余白の中） ─────────────────────────
  const footTop = H - M + (M - TYPE.folio) / 2 - 1;
  const running = [book.title.trim(), book.cover.name.trim()].filter(Boolean).join("　");
  sheets.forEach((p, n) => {
    if (n === 0) return;
    const folio = String(n + 1);
    p.texts.push({
      value: folio,
      lines: [folio],
      x: W - M - font.widthOfTextAtSize(folio, TYPE.folio),
      top: footTop,
      size: TYPE.folio,
      leading: TYPE.folio * LEADING.single,
      tone: "faint",
    });
    // 提出用は、ばらばらに見られても誰の何か分かるように、題と名前を下に小さく。
    if (book.purpose === "submission" && running) {
      let label = running;
      const max = CW - 60;
      while (label.length > 1 && font.widthOfTextAtSize(label, TYPE.running) > max)
        label = Array.from(label).slice(0, -2).join("") + "…";
      p.texts.push({
        value: label,
        lines: [label],
        x: M,
        // ページ番号と同じ並び（ベースライン）に。
        top: footTop + TYPE.folio - TYPE.running,
        size: TYPE.running,
        leading: TYPE.running * LEADING.single,
        tone: "faint",
      });
    }
  });
  return sheets;
}
