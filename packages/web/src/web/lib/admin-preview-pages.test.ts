import { describe, expect, test } from "bun:test";
import {
  isPreviewablePath,
  previewPageNotice,
  previewWorkPath,
  previewWorksFrom,
  type PreviewWork,
} from "./admin-preview-pages";
import { buildPublicSiteHref } from "../pages/admin-shared";

const work = (over: Partial<PreviewWork>): PreviewWork => ({
  id: 1,
  slug: "harbour",
  title: "港",
  kind: "series",
  isPublished: true,
  ...over,
});

describe("previewWorkPath", () => {
  test("places the work under its own shelf and encodes the slug as one segment", () => {
    expect(previewWorkPath({ kind: "series", slug: "harbour" })).toBe("/series/harbour");
    expect(previewWorkPath({ kind: "work", slug: "港 2026/夏" })).toBe(
      "/work/%E6%B8%AF%202026%2F%E5%A4%8F",
    );
  });
});

describe("isPreviewablePath", () => {
  test("accepts the fixed pages, including Work", () => {
    for (const path of ["/", "/gallery", "/series", "/work", "/about", "/contact"]) {
      expect(isPreviewablePath(path)).toBe(true);
    }
  });

  test("accepts encoded work pages only", () => {
    expect(isPreviewablePath("/series/harbour")).toBe(true);
    expect(isPreviewablePath(previewWorkPath({ kind: "work", slug: "港 2026/夏" }))).toBe(true);
    expect(isPreviewablePath("/work/港")).toBe(false);
    expect(isPreviewablePath("/series/a b")).toBe(false);
    expect(isPreviewablePath("/series/a/b")).toBe(false);
    expect(isPreviewablePath("/series/%E0%A4%A")).toBe(false);
    expect(isPreviewablePath("/series/")).toBe(false);
  });

  test("rejects anything else", () => {
    for (const path of ["/admin", "//example.com", "https://example.com/", "/photo/1", "/series/a?x=1", "javascript:alert(1)"]) {
      expect(isPreviewablePath(path)).toBe(false);
    }
  });
});

describe("buildPublicSiteHref", () => {
  test("opens the same work page the preview shows", () => {
    const path = previewWorkPath({ kind: "work", slug: "港 2026" });
    expect(buildPublicSiteHref(null, path)).toBe(path);
    expect(buildPublicSiteHref(null, "/work")).toBe("/work");
    expect(buildPublicSiteHref("seed", "/series/harbour")).toBe(
      "/series/harbour?admin-demo-preview=seed",
    );
  });

  test("falls back to the top page for paths it does not know", () => {
    expect(buildPublicSiteHref(null, "/admin")).toBe("/");
    expect(buildPublicSiteHref(null, "//example.com")).toBe("/");
  });
});

describe("previewWorksFrom", () => {
  test("reads the admin series rows and skips rows without a slug", () => {
    expect(
      previewWorksFrom([
        { id: 1, slug: "harbour", title: "港", kind: "work", isPublished: true },
        { id: 2, slug: "draft", title: "", kind: null, isPublished: false },
        { id: 3, slug: "", title: "slug なし" },
        null,
        "noise",
      ]),
    ).toEqual([
      { id: 1, slug: "harbour", title: "港", kind: "work", isPublished: true },
      // 題名が空なら slug で見分ける。棚が空の行はシリーズとして読む。
      { id: 2, slug: "draft", title: "draft", kind: "series", isPublished: false },
    ]);
  });

  test("treats a missing list as no works", () => {
    expect(previewWorksFrom(undefined)).toEqual([]);
    expect(previewWorksFrom({})).toEqual([]);
  });
});

describe("previewPageNotice", () => {
  const works = [
    work({ id: 1, slug: "harbour" }),
    work({ id: 2, slug: "draft", title: "下書きの作品", isPublished: false }),
    work({ id: 3, slug: "job", kind: "work" }),
  ];

  test("says nothing for pages that visitors can open", () => {
    for (const path of ["/", "/gallery", "/series", "/work", "/series/harbour", "/work/job"]) {
      expect(previewPageNotice(path, works)).toBeNull();
    }
  });

  test("does not judge work pages before the list arrives", () => {
    expect(previewPageNotice("/series/gone", undefined)).toBeNull();
    expect(previewPageNotice("/work", undefined)).toBeNull();
  });

  test("explains unpublished, deleted and moved pages", () => {
    expect(previewPageNotice("/series/draft", works)).toEqual({
      reason: "unpublished",
      title: "下書きの作品",
    });
    expect(previewPageNotice("/series/gone", works)).toEqual({ reason: "missing" });
    // 同じ slug でも、別の棚のURLは別のページ。
    expect(previewPageNotice("/work/harbour", works)).toEqual({ reason: "missing" });
  });

  test("warns that /work moves to Series while no Work is published", () => {
    const noWork = works.filter((w) => w.kind !== "work");
    expect(previewPageNotice("/work", noWork)).toEqual({ reason: "work-shelf-empty" });
    expect(
      previewPageNotice("/work", [...noWork, work({ id: 4, slug: "hidden", kind: "work", isPublished: false })]),
    ).toEqual({ reason: "work-shelf-empty" });
  });
});
