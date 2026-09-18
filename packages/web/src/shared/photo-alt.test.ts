import { test, expect } from "bun:test";
import { photoAltText } from "./photo-alt";

test("returns the title verbatim when present", () => {
  expect(photoAltText({ title: "夕暮れの街" }, { photographerName: "江口秋" })).toBe(
    "夕暮れの街",
  );
});

test("falls back to the description when there is no title", () => {
  expect(
    photoAltText(
      { title: "", description: "夕暮れの路地裏を歩く猫" },
      { photographerName: "江口秋" },
    ),
  ).toBe("夕暮れの路地裏を歩く猫");
});

test("builds a series + category + photographer sentence when title/description are missing", () => {
  expect(
    photoAltText(
      {},
      {
        seriesName: "〇〇",
        categoryLabel: "ポートレート",
        photographerName: "江口秋",
      },
    ),
  ).toBe("〇〇シリーズより、江口秋撮影のポートレート写真");
});

test("falls back to photographer-only phrasing when there is no series or category", () => {
  expect(photoAltText({}, { photographerName: "江口秋" })).toBe(
    "江口秋撮影の写真",
  );
});

test("falls back to just 写真 with completely empty context", () => {
  expect(photoAltText({})).toBe("写真");
});

// 2026-09-01: 公開写真497枚のうち、題・説明が入っているものは0件だった。
// つまり実運用ではこの下のフォールバックだけが使われている。
test("撮影時期を入れて、同じシリーズの写真が同じ一文にならないようにする", () => {
  const ctx = { seriesName: "Ishigaki Island", photographerName: "江口秋" };
  const a = photoAltText({ shotAt: "2024-08-19T13:47:04" }, ctx);
  const b = photoAltText({ shotAt: "2025-08-26T17:27:38" }, ctx);
  expect(a).toBe("Ishigaki Islandシリーズより、江口秋が2024年8月に撮影した写真");
  expect(b).toBe("Ishigaki Islandシリーズより、江口秋が2025年8月に撮影した写真");
  expect(a).not.toBe(b);
});

test("シリーズに属さない写真にも撮影時期を入れる", () => {
  expect(
    photoAltText(
      { shotAt: "2025-01-02T09:11:24" },
      { photographerName: "江口秋", categoryLabel: "ポートレート" },
    ),
  ).toBe("江口秋が2025年1月に撮影したポートレート写真");
});

test("Date でも文字列でも同じ結果になる", () => {
  const ctx = { photographerName: "江口秋" };
  expect(photoAltText({ shotAt: new Date("2024-08-19T13:47:04Z") }, ctx)).toBe(
    photoAltText({ shotAt: "2024-08-19T13:47:04Z" }, ctx),
  );
});

test("日付として読めない値は、時期を諦めて元の一文に戻る（例外にしない）", () => {
  const ctx = { seriesName: "〇〇", photographerName: "江口秋" };
  expect(photoAltText({ shotAt: "not-a-date" }, ctx)).toBe(
    "〇〇シリーズより、江口秋撮影の写真",
  );
  expect(photoAltText({ shotAt: null }, ctx)).toBe(
    "〇〇シリーズより、江口秋撮影の写真",
  );
});

test("題が入れば、そちらが勝つ（撮影時期を足さない）", () => {
  expect(
    photoAltText(
      { title: "夕暮れの街", shotAt: "2024-08-19T13:47:04" },
      { photographerName: "江口秋" },
    ),
  ).toBe("夕暮れの街");
});

test("撮影日は月までにとどめる（日は出さない）", () => {
  expect(
    photoAltText({ shotAt: "2024-08-19T13:47:04" }, { photographerName: "江口秋" }),
  ).not.toContain("19");
});

// 2026-09-19: フィルムの shotAt は複写（スキャン）した時刻で、撮影日ではない。
// ビューアの撮影情報は既に "Scanned" と出しているのに、説明文だけが
// 「○年○月に撮影」と言っていた（本番のフィルム39枚が該当）。
test("フィルムの日時を撮影日として言わない", () => {
  const alt = photoAltText(
    { shotAt: "2024-08-19T13:47:04", filmType: "フィルム" },
    { seriesName: "SICF Fukuoka", photographerName: "江口秋" },
  );
  expect(alt).toBe(
    "SICF Fukuokaシリーズより、江口秋撮影のフィルム写真（2024年8月スキャン）",
  );
  expect(alt).not.toContain("に撮影した");
});

test("フィルムでも時期は残すので、同じ組の写真が同じ一文にならない", () => {
  const ctx = { seriesName: "SICF Fukuoka", photographerName: "江口秋" };
  const a = photoAltText({ shotAt: "2024-08-19T13:47:04", filmType: "フィルム" }, ctx);
  const b = photoAltText({ shotAt: "2025-03-02T10:00:00", filmType: "フィルム" }, ctx);
  expect(a).not.toBe(b);
});

test("日時のないフィルムは、時期を足さずにフィルム写真とだけ言う", () => {
  expect(
    photoAltText({ filmType: "フィルム" }, { photographerName: "江口秋" }),
  ).toBe("江口秋撮影のフィルム写真");
  expect(
    photoAltText(
      { filmType: "フィルム", shotAt: "not-a-date" },
      { photographerName: "江口秋", categoryLabel: "ポートレート" },
    ),
  ).toBe("江口秋撮影のポートレートのフィルム写真");
});

test("デジタルは従来どおり撮影日として言える", () => {
  expect(
    photoAltText(
      { shotAt: "2024-08-19T13:47:04", filmType: "デジタル" },
      { photographerName: "江口秋" },
    ),
  ).toBe("江口秋が2024年8月に撮影した写真");
});
