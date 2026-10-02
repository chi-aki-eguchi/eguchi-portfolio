import { describe, test, expect } from "bun:test";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";
import {
  addPhoto,
  createBook,
  movePage,
  parseBook,
  removeItem,
  type SourcePhoto,
} from "./model";
import { fitImage, renderPortfolio, wrapText } from "./render";
import { CAPTION_GAP, LEADING, TYPE } from "./layout";
import { jaPhrases } from "../ja-phrases";
import fontkit from "@pdf-lib/fontkit";
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
      "../../../../public/fonts/pdf/NotoSansJP-Regular.ttf",
      import.meta.url,
    ),
  ),
);
const subsetWasm = new Uint8Array(
  readFileSync(new URL(import.meta.resolve("harfbuzzjs/dist/harfbuzz-subset.wasm"))),
);
const embeddedFont = async (bytes: Uint8Array) => {
  const pdf = await PDFDocument.load(bytes);
  const descriptors = pdf.context
    .enumerateIndirectObjects()
    .map(([, o]) => o)
    .filter(
      (o): o is PDFDict =>
        o instanceof PDFDict &&
        o.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"),
    );
  expect(descriptors).toHaveLength(1);
  const stream = descriptors[0].lookup(PDFName.of("FontFile2"));
  if (!(stream instanceof PDFRawStream)) throw new Error("Missing embedded TrueType font");
  return decodePDFRawStream(stream).decode();
};
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
  test("PDF preserves the complete TrueType font and Japanese glyph outlines", async () => {
    const b = make();
    const result = await renderPortfolio(b, [{ id: b.items[0].id, bytes: jpeg }], font);
    const pdf = await PDFDocument.load(result.bytes!);
    const descriptors = pdf.context.enumerateIndirectObjects().map(([, o]) => o)
      .filter((o): o is PDFDict => o instanceof PDFDict &&
        o.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"));
    expect(descriptors).toHaveLength(1);
    for (const descriptor of descriptors) {
      const stream = descriptor.lookup(PDFName.of("FontFile2"));
      if (!(stream instanceof PDFRawStream)) throw new Error("Missing embedded TrueType font");
      const bytes = decodePDFRawStream(stream).decode();
      expect(Array.from(bytes.slice(0, 4))).toEqual([0, 1, 0, 0]);
      expect(Buffer.from(bytes).equals(Buffer.from(font))).toBe(true);
      expect(descriptor.has(PDFName.of("FontFile3"))).toBe(false);
    }
  });
  test("フォントを使う文字だけに減らし、字形と字幅は元のまま", async () => {
    const b = make();
    b.title = "光と影の作品集";
    b.cover.name = "江口秋";
    const assets = [{ id: b.items[0].id, bytes: jpeg }];
    const whole = await renderPortfolio(b, assets, font);
    const small = await renderPortfolio(b, assets, font, () => {}, { subsetWasm });
    expect(small.issues.filter((i) => i.severity === "error")).toEqual([]);
    // 元は約3.4MB。使う字だけなら数十KB。
    expect(small.bytes!.byteLength * 20).toBeLessThan(whole.bytes!.byteLength);
    const bytes = await embeddedFont(small.bytes!);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0, 1, 0, 0]);
    const sub = fontkit.create(bytes),
      full = fontkit.create(font);
    const used = `${b.title}${b.cover.name}${source.title}${source.description}2`;
    for (const c of new Set(Array.from(used))) {
      const cp = c.codePointAt(0)!;
      expect(sub.hasGlyphForCodePoint(cp)).toBe(true);
      const g = sub.glyphForCodePoint(cp),
        g0 = full.glyphForCodePoint(cp);
      expect(g.advanceWidth).toBe(g0.advanceWidth);
      expect(g.path.toSVG()).toBe(g0.path.toSVG());
      if (c.trim()) expect(g.path.toSVG()).not.toBe("");
    }
  });
  test("送信用は印刷解像度の注意を出さず、印刷用だけ出す", async () => {
    const b = make();
    const assets = [{ id: b.items[0].id, bytes: jpeg }];
    const dpi = (r: { issues: { message: string }[] }) =>
      r.issues.some((i) => i.message.includes("dpi"));
    expect(dpi(await renderPortfolio(b, assets, font, () => {}, { quality: "print" }))).toBe(true);
    expect(dpi(await renderPortfolio(b, assets, font, () => {}, { quality: "screen" }))).toBe(false);
  });
  test("回転後の比率を保ち、実埋め込み寸法からdpiを求める", () => {
    const fit = fitImage(1600, 800, 400, 600, 90);
    expect(fit.width).toBe(300);
    expect(fit.height).toBe(600);
    expect(fit.dpi).toBe(192);
  });
  const perChar = { widthOfTextAtSize: (s: string) => Array.from(s).length * 10 };
  test("改行と長い日本語を文字欠落なく折り返す", () => {
    const text = "長い日本語の作品名ABC、句読点。";
    const lines = wrapText(text, 30, 10, perChar);
    expect(lines.join("")).toBe(text);
    // 句読点だけは行末にぶら下げ、行頭には置かない。
    expect(lines.every((s) => s.replace(/[、。]$/, "").length <= 3)).toBe(true);
    expect(lines.slice(1).some((s) => /^[、。]/.test(s))).toBe(false);
    expect(wrapText("一行目\n\n三行目", 100, 10, perChar)).toEqual(["一行目", "", "三行目"]);
  });
  test("語の途中で折らず、文節の切れ目で折り返す", () => {
    const text = "デジタルカメラで撮影した、静かな港の朝の写真です。";
    const ends = new Set<number>();
    jaPhrases(text).reduce((n, p) => (ends.add(n + p.length), n + p.length), 0);
    const lines = wrapText(text, 120, 10, perChar);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
    let end = 0;
    for (const line of lines) expect(ends.has((end += line.length))).toBe(true);
  });
  test("1文節が枠より長いときも、長音・小書きのかなを行頭に置かない", () => {
    const lines = wrapText("フォトグラファーのポートフォリオ", 30, 10, perChar);
    expect(lines.join("")).toBe("フォトグラファーのポートフォリオ");
    expect(lines.slice(1).some((s) => /^[ーァィゥェォッャュョ]/.test(s))).toBe(false);
    expect(lines.every((s) => s.length <= 3)).toBe(true);
  });
  test("欧文は語の切れ目で折る", () => {
    const lines = wrapText("Light and shadow on the harbor", 100, 10, perChar);
    expect(lines).toEqual(["Light and", "shadow on", "the harbor"]);
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
    expect(empty.height - short.height).toBeCloseTo(
      TYPE.captionText * LEADING.caption + CAPTION_GAP,
    );
    b.items[0].captionOverride = "説明\n二行目\n三行目";
    const longer = layoutBook(b, measure)[1].photos[0];
    expect(short.height - longer.height).toBeCloseTo(
      2 * TYPE.captionText * LEADING.caption,
    );
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
  expect(caption.top - photo.top - photo.height).toBeCloseTo(CAPTION_GAP);
  // 説明は写真の左端にそろえる。
  expect(caption.x).toBeCloseTo(photo.x);
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

test("作品名だけを濃く、表紙は写真の下に題、番号と柱は下の余白に", async () => {
  const { layoutBook } = await import("./layout");
  const measure = {
    widthOfTextAtSize: (s: string, size: number) => Array.from(s).length * size,
  };
  let b = addPhoto(make(), { ...source, id: 2 });
  b.title = "港の朝";
  b.cover.name = "江口秋";
  b.cover.itemId = b.items[0].id;
  b.items.forEach((i) => (i.rotation = 0));
  b.items[0].year = "2026";
  b.items[0].technique = "インクジェットプリント";
  b.items[1].captionOverride = "長い説明\n二行目\n三行目";
  b.orientation = "landscape";
  b.pages = [
    {
      ...b.pages[0],
      layout: "two",
      itemIds: b.items.map((i) => i.id),
      pairing: "across",
    },
  ];
  const sizes = new Map([
    [b.items[0].id, { width: 1600, height: 1000 }],
    [b.items[1].id, { width: 1600, height: 1000 }],
  ]);
  const [cover, work] = layoutBook(b, measure, sizes);
  // 表紙: 題は写真の下、写真の左端から。名前は控えめな色。
  const [title, name] = cover.texts;
  expect(title.value).toBe("港の朝");
  expect(title.top).toBeGreaterThan(cover.photos[0].top + cover.photos[0].height);
  expect(title.x).toBeCloseTo(cover.photos[0].x);
  expect([title.tone, name.tone]).toEqual(["ink", "quiet"]);
  // 2枚の横並び: 説明の長さが違っても写真の上端・高さ・説明の始まりがそろう。
  const [a, c] = work.photos;
  expect(a.top).toBeCloseTo(c.top);
  expect(a.height).toBeCloseTo(c.height);
  const first = (id: string) => work.texts.find((t) => t.itemId === id)!;
  expect(first(b.items[0].id).top).toBeCloseTo(first(b.items[1].id).top);
  expect(first(b.items[1].id).x).toBeCloseTo(c.x);
  // 作品名は墨、制作年・技法と説明は控えめ。
  const own = work.texts.filter((t) => t.itemId === b.items[0].id);
  expect(own.map((t) => [t.value, t.tone])).toEqual([
    [source.title, "ink"],
    ["2026 / インクジェットプリント", "quiet"],
    [source.description, "quiet"],
  ]);
  // ページ番号は右下の余白に右寄せ、提出用は題と名前の柱を左下に。
  const folio = work.texts.find((t) => t.value === "2")!;
  expect(folio.tone).toBe("faint");
  expect(folio.top).toBeGreaterThan(work.height - 42.52);
  expect(folio.x + measure.widthOfTextAtSize("2", folio.size)).toBeCloseTo(
    work.width - 42.52,
  );
  const running = work.texts.find((t) => t.value === "港の朝　江口秋")!;
  expect(running.x).toBeCloseTo(42.52);
  expect(running.top + running.size).toBeCloseTo(folio.top + folio.size);
  expect(cover.texts.some((t) => t.tone === "faint")).toBe(false);
  b.purpose = "photobook";
  expect(
    layoutBook(b, measure, sizes)[1].texts.some((t) => t.value.includes("江口秋")),
  ).toBe(false);
});

test("横並び2枚の説明は、比率と長さがどう違っても自分の列からはみ出さない", async () => {
  const { layoutBook } = await import("./layout");
  const measure = {
    widthOfTextAtSize: (s: string, size: number) => Array.from(s).length * size,
  };
  const captions = ["", "短い説明", "説明の一行目\n二行目\n三行目", "長い説明。".repeat(30)];
  const cases = (["portrait", "landscape"] as const).flatMap((orientation) =>
    ([1, 0.7] as const).flatMap((imageScale) =>
      [0.66, 1, 1.5, 2.2].flatMap((r0) =>
        [0.66, 1.5].flatMap((r1) =>
          captions.flatMap((c0) =>
            captions.map((c1) => ({ orientation, imageScale, r0, r1, c0, c1 })),
          ),
        ),
      ),
    ),
  );
  for (const { orientation, imageScale, r0, r1, c0, c1 } of cases) {
    const b = addPhoto(make(), { ...source, id: 2 });
    b.orientation = orientation;
    b.items.forEach((i) => (i.rotation = 0));
    b.items[0].captionOverride = c0;
    b.items[1].captionOverride = c1;
    b.pages = [
      {
        ...b.pages[0],
        layout: "two",
        itemIds: b.items.map((i) => i.id),
        pairing: "across",
        imageScale,
      },
    ];
    const sizes = new Map([
      [b.items[0].id, { width: 1000 * r0, height: 1000 }],
      [b.items[1].id, { width: 1000 * r1, height: 1000 }],
    ]);
    const sheet = layoutBook(b, measure, sizes)[1];
    const [left, right] = sheet.photos;
    expect(left.top).toBeCloseTo(right.top);
    expect(left.height).toBeCloseTo(right.height);
    const edge = (id: string) =>
      Math.max(
        -Infinity,
        ...sheet.texts
          .filter((t) => t.itemId === id)
          .flatMap((t) => t.lines.map((l) => t.x + measure.widthOfTextAtSize(l, t.size))),
      );
    // 句読点のぶら下げ1字（9.5pt 以下）までは許す。
    expect(edge(b.items[0].id)).toBeLessThanOrEqual(right.x - 28 + 9.5);
    expect(edge(b.items[1].id)).toBeLessThanOrEqual(sheet.width - 42.52 + 9.5);
    for (const t of sheet.texts.filter((t) => t.itemId))
      expect(t.top + t.lines.length * t.leading).toBeLessThanOrEqual(
        sheet.height - 42.52 + 0.01,
      );
  }
});

describe("受け取った人が使いやすい PDF", () => {
  test("保存の名前は氏名と本の名前。印刷用だけ印をつけ、ファイル名に使えない字は空白に", async () => {
    const { pdfFileName } = await import("./model");
    const b = make();
    b.title = "光のあと";
    b.cover.name = "江口秋";
    expect(pdfFileName(b, "screen")).toBe("江口秋_光のあと.pdf");
    expect(pdfFileName(b, "print")).toBe("江口秋_光のあと_印刷用.pdf");
    b.title = "2026/10: 港*の朝";
    b.cover.name = "";
    expect(pdfFileName(b, "screen")).toBe("2026 10 港 の朝.pdf");
    b.title = "";
    b.cover.name = "江口秋";
    expect(pdfFileName(b, "screen")).toBe("江口秋_作品集.pdf");
  });
  test("メールと URL は押せる。行をまたぐ URL も、日本語のドメインも正しい宛先に", async () => {
    const { textLinks } = await import("./render");
    expect(
      textLinks({
        value: "autumn@example.invalid\nhttps://akieguchi.com/works（作品）",
        lines: ["autumn@example.invalid", "https://akieguchi.com/works（作品）"],
      }),
    ).toEqual([
      { line: 0, start: 0, end: 22, uri: "mailto:autumn@example.invalid" },
      { line: 1, start: 0, end: 27, uri: "https://akieguchi.com/works" },
    ]);
    expect(
      textLinks({
        value: "サイト https://例え.jp/写真 と www.akieguchi.com.",
        lines: ["サイト https://例え.jp/写真 と", "www.akieguchi.com."],
      }).map((l) => l.uri),
    ).toEqual(["https://xn--r8jz45g.jp/%E5%86%99%E7%9C%9F", "https://www.akieguchi.com/"]);
    expect(
      textLinks({
        value: "https://example.com/very/long/path",
        lines: ["https://example.com/", "very/long/path"],
      }),
    ).toEqual([
      { line: 0, start: 0, end: 20, uri: "https://example.com/very/long/path" },
      { line: 1, start: 0, end: 14, uri: "https://example.com/very/long/path" },
    ]);
    expect(textLinks({ value: "連絡先は後日", lines: ["連絡先は後日"] })).toEqual([]);
  });
  test("PDF の連絡先にリンクが付き、表紙・作品・プロフィールのしおりがある", async () => {
    const b = make();
    b.title = "光のあと";
    b.cover.name = "江口秋";
    b.pdfProfile = {
      enabled: true,
      text: "写真の記録です。",
      contact: "autumn@example.invalid\nhttps://akieguchi.com",
    };
    const r = await renderPortfolio(b, [{ id: b.items[0].id, bytes: jpeg }], font);
    const pdf = await PDFDocument.load(r.bytes!);
    const pages = pdf.getPages();
    const annots = pages[pages.length - 1].node.Annots()!;
    const links = annots.asArray().map((ref) => {
      const d = pdf.context.lookup(ref, PDFDict);
      const a = d.lookup(PDFName.of("A"), PDFDict);
      const rect = d.lookup(PDFName.of("Rect"), PDFArray).asArray().map((n) => (n as PDFNumber).asNumber());
      return { uri: (a.lookup(PDFName.of("URI")) as PDFString).decodeText(), rect };
    });
    expect(links.map((l) => l.uri)).toEqual(["mailto:autumn@example.invalid", "https://akieguchi.com/"]);
    for (const { rect } of links) {
      expect(rect[0]).toBeCloseTo(42.52);
      expect(rect[2]).toBeGreaterThan(rect[0] + 50);
      expect(rect[3]).toBeGreaterThan(rect[1]);
    }
    expect(pages[0].node.Annots()?.size() ?? 0).toBe(0);
    const outlines = pdf.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    expect((outlines.get(PDFName.of("Count")) as PDFNumber).asNumber()).toBe(3);
    const titles: string[] = [];
    let item = outlines.lookup(PDFName.of("First")) as PDFDict | undefined;
    while (item) {
      titles.push((item.lookup(PDFName.of("Title")) as PDFHexString).decodeText());
      expect(item.lookup(PDFName.of("Dest"), PDFArray).get(0)).toBe(pages[titles.length - 1].ref);
      item = item.lookup(PDFName.of("Next")) as PDFDict | undefined;
    }
    expect(titles).toEqual(["表紙", source.title, "プロフィール"]);
    b.purpose = "photobook";
    const book = await PDFDocument.load(
      (await renderPortfolio(b, [{ id: b.items[0].id, bytes: jpeg }], font)).bytes!,
    );
    const first = book.catalog.lookup(PDFName.of("Outlines"), PDFDict).lookup(PDFName.of("First"), PDFDict);
    const second = first.lookup(PDFName.of("Next"), PDFDict);
    expect((second.lookup(PDFName.of("Title")) as PDFHexString).decodeText()).toBe("2ページ");
  });
});
