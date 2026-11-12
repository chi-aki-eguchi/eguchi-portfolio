import { describe, expect, test } from "bun:test";
import {
  formatYen,
  TOKYO_COPY,
  TOKYO_LANGS,
  TOKYO_PATHS,
  TOKYO_SHOOT,
  tokyoDateLabel,
  tokyoDescription,
  tokyoDocumentTitle,
  tokyoFallbackParagraphs,
  tokyoInquiryFields,
  tokyoLangFromPath,
  tokyoOpenDates,
  tokyoOpenSummary,
  tokyoPhotoIds,
  tokyoPlanLine,
} from "./tokyo-shoot";

describe("東京の撮影プラン（/tokyo）", () => {
  test("住所と言語が対になる。繁體中文が /tokyo", () => {
    expect(tokyoLangFromPath("/tokyo")).toBe("zh-Hant");
    expect(tokyoLangFromPath("/tokyo/")).toBe("zh-Hant");
    expect(tokyoLangFromPath("/tokyo/en")).toBe("en");
    expect(tokyoLangFromPath("/tokyo/ja")).toBe("ja");
    expect(tokyoLangFromPath("/tokyo/zh")).toBeNull();
    expect(tokyoLangFromPath("/tokyos")).toBeNull();
    for (const lang of TOKYO_LANGS) expect(tokyoLangFromPath(TOKYO_PATHS[lang])).toBe(lang);
  });

  test("料金と時間は1か所の数字から、3言語とも同じ値で出る", () => {
    for (const lang of TOKYO_LANGS) {
      const text = tokyoFallbackParagraphs(lang).join("\n");
      for (const plan of TOKYO_SHOOT.plans) {
        expect(text).toContain(formatYen(plan.priceYen));
        expect(text).toContain(TOKYO_COPY[lang].duration(plan.minutes));
      }
      const digital = TOKYO_SHOOT.plans.find((p) => p.id === "digital")!;
      const detail = TOKYO_COPY[lang].plan.digital.detail(digital);
      expect(detail).toContain(String(digital.frames));
      expect(detail).toContain(String(digital.deliveryDays));
      expect(detail).not.toContain("undefined");
    }
    expect(formatYen(15000)).toBe("¥15,000");
  });

  test("注意事項は仮の文面だと分かる見出しで出す", () => {
    expect(TOKYO_COPY.ja.notesLabel).toContain("仮");
    expect(TOKYO_COPY["zh-Hant"].notesLabel).toContain("暫定");
    expect(TOKYO_COPY.en.notesLabel.toLowerCase()).toContain("provisional");
  });

  test("3言語で項目の数がそろっている（片方だけ足し忘れない）", () => {
    for (const lang of TOKYO_LANGS) {
      expect(TOKYO_COPY[lang].flow).toHaveLength(TOKYO_COPY.ja.flow.length);
      expect(TOKYO_COPY[lang].notes).toHaveLength(TOKYO_COPY.ja.notes.length);
      expect(TOKYO_COPY[lang].lead).toHaveLength(TOKYO_COPY.ja.lead.length);
    }
  });

  test("題：英語と繁體中文には日本語の肩書きを入れない", () => {
    const names = { nameJa: "江口秋", nameEn: "Aki Eguchi", subtitle: "写真学生" };
    expect(tokyoDocumentTitle("zh-Hant", names)).toBe("東京旅拍｜中文攝影師・底片人像 | 江口秋 | Aki Eguchi");
    expect(tokyoDocumentTitle("en", names)).toBe("Tokyo Portrait Photographer | Film & Digital Sessions | Aki Eguchi");
    expect(tokyoDocumentTitle("ja", names)).toBe("東京での撮影プラン｜旅行中のポートレート・フィルム撮影 | 江口秋 | Aki Eguchi | 写真学生");
    expect(tokyoDescription("en", names)).not.toMatch(/[぀-ヿ一-鿿]/);
  });

  test("受けられる日：2026年12月の日曜と火曜。過ぎた日は出さない", () => {
    expect(tokyoOpenDates("2026-11-12")).toEqual([
      "2026-12-01",
      "2026-12-06",
      "2026-12-08",
      "2026-12-13",
      "2026-12-15",
      "2026-12-20",
      "2026-12-22",
      "2026-12-27",
      "2026-12-29",
    ]);
    // 当日は受けない。月が終われば空（フォームは日付を自由に選ぶ欄に戻る）。
    expect(tokyoOpenDates("2026-12-20")[0]).toBe("2026-12-22");
    expect(tokyoOpenDates("2026-12-29")).toEqual([]);
    expect(tokyoOpenSummary("ja")).toBe("12月の日曜・火曜");
    expect(tokyoOpenSummary("zh-Hant")).toBe("12 月的星期日、星期二");
    expect(tokyoOpenSummary("en")).toBe("Sundays and Tuesdays in December");
    expect(tokyoDateLabel("ja", "2026-12-06")).toBe("12/6（日）");
    expect(tokyoDateLabel("zh-Hant", "2026-12-01")).toBe("12/1（二）");
    expect(tokyoDateLabel("en", "2026-12-01")).toBe("Tue 1 Dec");
    expect(tokyoDateLabel("ja", "未定")).toBe("未定");
  });

  test("作例：管理画面で選んだ物があればその順、無ければ仮の並び", () => {
    expect(tokyoPhotoIds("12, 7,12")).toEqual([12, 7]);
    expect(tokyoPhotoIds("")).toEqual([...TOKYO_SHOOT.photoIds]);
    expect(tokyoPhotoIds(undefined)).toEqual([...TOKYO_SHOOT.photoIds]);
  });

  test("通知の内容：項目名と選択肢は、どの言語のページから送っても日本語で届く", () => {
    const fields = tokyoInquiryFields({
      pageLang: "zh-Hant",
      date: "2026-12-01",
      people: "2人",
      planId: "medium",
      areaId: "asakusa",
      name: " 王小明 ",
      email: " test@example.com ",
      social: "",
      language: "中文",
      message: "",
    });
    expect(fields.subject).toBe("東京撮影プランの申し込み");
    expect(fields.name).toBe("王小明");
    expect(fields.email).toBe("test@example.com");
    expect(fields["プラン"]).toBe(tokyoPlanLine("ja", TOKYO_SHOOT.plans[2]!));
    expect(fields["プラン"]).toContain("¥35,000");
    expect(fields["エリア"]).toBe("浅草");
    expect(fields["希望日"]).toBe("2026-12-01（火）");
    expect(fields["ページ"]).toBe("/tokyo");
    // 空の任意項目は送らない。
    expect("message" in fields).toBe(false);
    expect("Instagram・LINE" in fields).toBe(false);
    // エリアを選ばなかったとき。
    expect(tokyoInquiryFields({ pageLang: "en", date: "other", people: "1人", planId: "digital", areaId: "", name: "a", email: "b", social: "@x", language: "English", message: "hi" })["エリア"]).toBe("その他・未定");
  });
});
