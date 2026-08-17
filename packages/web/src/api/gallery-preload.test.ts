/**
 * 「先読みしている写真8枚が、実際には使われない」の回帰テスト。
 *
 * 先読みは、一覧が実際に取りに行くURLと**一字一句同じ**でないと空振りする。
 * ここでは `PhotoGallery.tsx` が使うのと同じ関数（`shared/image-presets.ts`）で
 * 期待値を作る。文字列を手で書くと、テストと実装が同じずれ方をして通ってしまう。
 */
import { test, expect, describe } from "bun:test";
import { buildGalleryPreloadTags } from "./gallery-preload";
import { escapeHtml } from "./ogp";
import { GRID_SIZES, srcSetFor, srcFor } from "../shared/image-presets";

// 属性の中では & が &amp; になる（HTMLとして正しく、ブラウザは & として読む）。
// 期待値も同じ escapeHtml を通し、値そのものの一致を見る。
const attr = (v: string) => escapeHtml(v);

const PHOTO = { url: "/api/images/photos/a.jpg", rotationDeg: 0 };

describe("ギャラリーの先読みタグ", () => {
  test("作り置きサムネがある枚は、そのURLをそのまま先読みする", () => {
    const out = buildGalleryPreloadTags([
      { ...PHOTO, preloadUrl: "https://cdn.example.com/thumbs/a.webp" },
    ]);
    expect(out).toBe(
      '<link rel="preload" as="image" href="https://cdn.example.com/thumbs/a.webp">',
    );
    // 一覧はこの枚に <source> を出さないので、srcset を付けると別物を取りに行く。
    expect(out).not.toContain("imagesrcset");
  });

  test("サムネが無い枚は、一覧が当てにいく avif の srcset と完全一致させる", () => {
    const out = buildGalleryPreloadTags([PHOTO]);
    // PhotoGallery.tsx の <source type="image/avif" srcSet={photoSrcSetFor(photo,"grid","avif")}>
    // と同じ値であること。
    expect(out).toContain(`imagesrcset="${attr(srcSetFor(PHOTO.url, "grid", "avif", 0))}"`);
    expect(out).toContain(`imagesizes="${attr(GRID_SIZES)}"`);
    expect(out).toContain('type="image/avif"');
  });

  test("href は srcset の中の一番小さい候補と一致する", () => {
    const out = buildGalleryPreloadTags([PHOTO]);
    const href = srcFor(PHOTO.url, 400, 82, "avif", 0);
    expect(out).toContain(`href="${attr(href)}"`);
    // href が候補の外だと、その1枚だけ余分に取りに行くことになる。
    expect(srcSetFor(PHOTO.url, "grid", "avif", 0)).toContain(href);
  });

  test("回転している写真でも、回転を含んだURLで先読みする", () => {
    const rotated = { url: "/api/images/photos/b.jpg", rotationDeg: 90 };
    const out = buildGalleryPreloadTags([rotated]);
    expect(out).toContain(`imagesrcset="${attr(srcSetFor(rotated.url, "grid", "avif", 90))}"`);
    expect(out).toContain("rot=90");
  });

  test("複数枚は改行で連ね、0枚なら空文字になる", () => {
    expect(buildGalleryPreloadTags([])).toBe("");
    const two = buildGalleryPreloadTags([
      { ...PHOTO, preloadUrl: "https://cdn.example.com/a.webp" },
      { url: "/api/images/photos/c.jpg", rotationDeg: 0, preloadUrl: "https://cdn.example.com/c.webp" },
    ]);
    expect(two.split("\n").length).toBe(2);
  });

  test("URLに引用符が混ざっても属性を壊さない", () => {
    const out = buildGalleryPreloadTags([
      { url: "/api/images/photos/a.jpg", rotationDeg: 0, preloadUrl: 'https://cdn.example.com/a".webp' },
    ]);
    expect(out).not.toContain('a".webp');
    expect(out).toContain("&quot;");
  });
});
