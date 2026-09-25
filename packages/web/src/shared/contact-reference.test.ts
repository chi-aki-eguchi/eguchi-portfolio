import { test, expect } from "bun:test";
import {
  contactHrefForWork,
  contactReferenceValue,
  workPublicUrl,
  workSlugFromSearch,
} from "./contact-reference";

test("相談リンクは作品の識別子だけを渡す", () => {
  expect(contactHrefForWork("rintaro")).toBe("/contact?work=rintaro");
  expect(contactHrefForWork("港-2026")).toBe(
    `/contact?work=${encodeURIComponent("港-2026")}`,
  );
});

test("クエリから識別子を取り出す（符号化された日本語も戻る）", () => {
  expect(workSlugFromSearch("?work=rintaro")).toBe("rintaro");
  expect(workSlugFromSearch("work=rintaro&other=1")).toBe("rintaro");
  expect(workSlugFromSearch(`?work=${encodeURIComponent("港-2026")}`)).toBe(
    "港-2026",
  );
});

test("識別子として成り立たないものは無視する（通常のContactになる）", () => {
  expect(workSlugFromSearch("")).toBe("");
  expect(workSlugFromSearch("?other=1")).toBe("");
  expect(workSlugFromSearch("?work=")).toBe("");
  expect(workSlugFromSearch("?work=a/b")).toBe("");
  expect(workSlugFromSearch("?work=a%20b")).toBe("");
  expect(workSlugFromSearch(`?work=${"x".repeat(201)}`)).toBe("");
  // 制御文字（改行以外も）。以前の正規表現は JavaScriptCore で読めなかった。
  expect(workSlugFromSearch("?work=a%01b")).toBe("");
  expect(workSlugFromSearch("?work=a%1Fb")).toBe("");
  expect(workSlugFromSearch("?work=sea-2026")).toBe("sea-2026");
});

test("送信内容の一行は、題名と公開URLの両方を持つ", () => {
  expect(
    contactReferenceValue("Rintaro Otsuka", "https://akieguchi.com/work/rintaro"),
  ).toBe("Rintaro Otsuka — https://akieguchi.com/work/rintaro");
  expect(contactReferenceValue("", "https://example.com/work/x")).toBe(
    "https://example.com/work/x",
  );
});

test("基準URLが未設定なら、いま見ているサイトの origin を使う", () => {
  expect(
    workPublicUrl("https://akieguchi.com", "https://other.example", "rintaro"),
  ).toBe("https://akieguchi.com/work/rintaro");
  expect(workPublicUrl("https://akieguchi.com/", "", "rintaro")).toBe(
    "https://akieguchi.com/work/rintaro",
  );
  expect(workPublicUrl("", "https://preview.example", "rintaro")).toBe(
    "https://preview.example/work/rintaro",
  );
  expect(workPublicUrl(undefined, "https://preview.example", "港-2026")).toBe(
    `https://preview.example/work/${encodeURIComponent("港-2026")}`,
  );
});
