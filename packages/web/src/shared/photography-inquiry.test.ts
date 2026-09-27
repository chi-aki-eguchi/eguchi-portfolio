import { expect, test } from "bun:test";
import { photographyInquiryFor, PHOTOGRAPHY_INQUIRY } from "./photography-inquiry";
import { publicPageFallbackText } from "../api/ogp";

test("photography copy stays off customer sites and English pages", () => {
  expect(photographyInquiryFor("https://akieguchi.com")).toBe(PHOTOGRAPHY_INQUIRY);
  expect(photographyInquiryFor("https://example.com")).toBeNull();
  expect(photographyInquiryFor(undefined)).toBeNull();
  expect(photographyInquiryFor("https://akieguchi.com", true)).toBeNull();
});

test("search fallback includes the same photography answers as the page", () => {
  const text = publicPageFallbackText({ siteUrl: "https://akieguchi.com" }, "/contact");
  expect(text.paragraphs).toContain(PHOTOGRAPHY_INQUIRY.intro);
  for (const { a } of PHOTOGRAPHY_INQUIRY.questions) expect(text.paragraphs).toContain(a);
  expect(publicPageFallbackText({ siteUrl: "https://example.com" }, "/contact").paragraphs).not.toContain(PHOTOGRAPHY_INQUIRY.intro);
});
