import { describe, expect, test } from "bun:test";
import { buildSitemapXml, type SitemapPhoto } from "./sitemap-xml";

const photo = (over: Partial<SitemapPhoto> = {}): SitemapPhoto => ({
  id: 1,
  url: "/api/images/photos/a.jpg",
  title: "",
  seriesId: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  ...over,
});

const base = () => ({
  siteUrl: "https://example.com",
  paths: ["/", "/gallery", "/series", "/about", "/contact"],
  seriesPaths: ["/series/indigoblue"],
  seriesIdBySlugPath: new Map([["/series/indigoblue", 7]]),
  seriesById: new Map([[7, { title: "indigo blue", coverPhotoId: 20 }]]),
  photos: [
    photo({ id: 10, url: "/api/images/photos/loose.jpg" }),
    photo({
      id: 20,
      url: "/api/images/photos/cover.jpg",
      seriesId: 7,
      createdAt: new Date("2026-07-20T00:00:00Z"),
    }),
    photo({ id: 21, url: "/api/images/photos/second.jpg", seriesId: 7 }),
  ],
  profilePhotoUrl: "/api/images/profile/me.jpg",
  photographerName: "江口秋",
});

const imageLocs = (xml: string) =>
  [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]);

describe("buildSitemapXml", () => {
  test("シリーズの写真は、そのシリーズのページの中身として出す（表紙が先頭）", () => {
    const xml = buildSitemapXml(base());
    expect(imageLocs(xml)).toEqual([
      "https://example.com/api/images/profile/me.jpg",
      "https://example.com/api/images/photos/cover.jpg",
      "https://example.com/api/images/photos/second.jpg",
    ]);
  });

  test("どのシリーズにも属さない写真は推さない（/gallery に全件をぶら下げない）", () => {
    // 2026-08-14 のオーナー判断。全公開写真を /gallery に付けていた形へは戻さない。
    const xml = buildSitemapXml(base());
    expect(xml).not.toContain("/api/images/photos/loose.jpg");
    const galleryLine = xml
      .split("\n")
      .find((l) => l.includes("<loc>https://example.com/gallery</loc>"))!;
    expect(galleryLine).not.toContain("<image:image>");
  });

  test("1つのシリーズに付ける画像の数には上限がある", () => {
    const input = base();
    const many = Array.from({ length: 250 }, (_, i) =>
      photo({ id: 100 + i, url: `/api/images/photos/p${i}.jpg`, seriesId: 7 }),
    );
    const xml = buildSitemapXml({ ...input, photos: [...input.photos, ...many] });
    const seriesImages = imageLocs(xml).filter((u) => !u.includes("/profile/"));
    expect(seriesImages.length).toBe(200);
  });

  test("画像には必ず言葉が付く（無題のまま出さない）", () => {
    const xml = buildSitemapXml(base());
    expect(xml).toContain("<image:title>江口秋</image:title>");
    // title 未入力の写真は photoAltText がシリーズ名から文を作る。
    expect(xml).toContain(
      "<image:title>indigo blueシリーズより、江口秋撮影の写真</image:title>",
    );
    expect(
      [...xml.matchAll(/<image:image>/g)].length,
      "画像エントリと同数のタイトルが出ている",
    ).toBe([...xml.matchAll(/<image:title>/g)].length);
  });

  test("写真にタイトルが入っていればそちらを使う", () => {
    const input = base();
    const photos = input.photos.map((p) =>
      p.id === 20 ? { ...p, title: "藍の朝" } : p,
    );
    const xml = buildSitemapXml({ ...input, photos });
    expect(xml).toContain("<image:title>藍の朝</image:title>");
  });

  test("表紙が未設定・削除済みなら、そのシリーズの先頭写真へ退避する", () => {
    const input = base();
    const xml = buildSitemapXml({
      ...input,
      seriesById: new Map([[7, { title: "indigo blue", coverPhotoId: null }]]),
    });
    expect(imageLocs(xml)).toContain(
      "https://example.com/api/images/photos/cover.jpg",
    );
  });

  test("プロフィール写真が無ければ /about に画像を出さない", () => {
    const input = base();
    const xml = buildSitemapXml({ ...input, profilePhotoUrl: undefined });
    expect(imageLocs(xml)).toEqual([
      "https://example.com/api/images/photos/cover.jpg",
      "https://example.com/api/images/photos/second.jpg",
    ]);
  });

  test("lastmod は実際に分かるページにだけ出す", () => {
    const xml = buildSitemapXml(base());
    const entry = (path: string) =>
      xml
        .split("\n")
        .find((line) => line.includes(`<loc>https://example.com${path}</loc>`))!;
    // 写真の最新登録日。毎回「今日」を入れない。
    expect(entry("/")).toContain("<lastmod>2026-07-20</lastmod>");
    expect(entry("/gallery")).toContain("<lastmod>2026-07-20</lastmod>");
    // シリーズはそのシリーズの写真の最新日。
    expect(entry("/series/indigoblue")).toContain(
      "<lastmod>2026-07-20</lastmod>",
    );
    // 日付の根拠が無いページには出さない（lastmod は必須要素ではない）。
    expect(entry("/about")).not.toContain("<lastmod>");
    expect(entry("/contact")).not.toContain("<lastmod>");
  });

  test("写真が1枚も無くてもURLは出し、壊れたXMLにしない", () => {
    const xml = buildSitemapXml({ ...base(), photos: [] });
    expect(imageLocs(xml)).toEqual([
      "https://example.com/api/images/profile/me.jpg",
    ]);
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).not.toContain("<lastmod>");
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  test("英語のAboutにもプロフィール写真を出す", () => {
    const input = base();
    const xml = buildSitemapXml({
      ...input,
      paths: [...input.paths, "/en/about", "/en/contact"],
    });
    expect(
      imageLocs(xml).filter((u) => u.endsWith("/profile/me.jpg")),
    ).toHaveLength(2);
  });
});
