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
