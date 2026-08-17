// sitemap.xml の組み立てだけを行う純粋な関数。DB取得は server.ts 側に残し、
// ここは「取れたデータ → XML」に閉じる（Hono・DB・S3 を持ち込まずにテストできる）。
import { escapeHtml } from "./ogp";
import { photoAltText } from "../shared/photo-alt";

export type SitemapPhoto = {
  id: number;
  url: string;
  title: string;
  seriesId: number | null;
  createdAt: Date | null;
};

export type SitemapSeries = { title: string; coverPhotoId: number | null };

export type SitemapInput = {
  siteUrl: string;
  /** 静的パス。先頭は "/" */
  paths: readonly string[];
  /** 公開シリーズの詳細パス */
  seriesPaths: readonly string[];
  seriesIdBySlugPath: ReadonlyMap<string, number>;
  seriesById: ReadonlyMap<number, SitemapSeries>;
  photos: readonly SitemapPhoto[];
  profilePhotoUrl?: string;
  photographerName?: string;
};

const isoDay = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : "";

export function buildSitemapXml(input: SitemapInput): string {
  const {
    siteUrl,
    paths,
    seriesPaths,
    seriesIdBySlugPath,
    seriesById,
    photos,
    profilePhotoUrl,
    photographerName = "",
  } = input;

  const photoById = new Map(photos.map((p) => [p.id, p]));

  const imageTag = (url: string, title: string) =>
    `<image:image><image:loc>${siteUrl}${escapeHtml(url)}</image:loc>${
      title
        ? `<image:title>${escapeHtml(title)}</image:title><image:caption>${escapeHtml(title)}</image:caption>`
        : ""
    }</image:image>`;

  // 公開する画像は「シリーズの表紙」と「プロフィール写真」だけに絞る。
  // 2026-08-14 の実測では /gallery に全公開写真569件を付けていて、そのうち
  // タイトル付きは0件だった。言葉の無い画像は順位が付かず、並びから1枚だけ
  // 剥がして配ることになる。少数を言葉付きで出すほうが安全でも効果でも上、
  // というオーナー判断。**サイトマップから外すのは「推さない」であって
  // 「遮断」ではない**（巡回で見つかる経路は残る）。
  const imagesFor = (path: string): string => {
    // 名前で検索した人に返したいのは本人の写真。JSON-LD は既に Person の
    // image として宣言しているのに、サイトマップだけ持っていなかった。
    if (path === "/about" || path === "/en/about") {
      return profilePhotoUrl ? imageTag(profilePhotoUrl, photographerName) : "";
    }
    const sid = seriesIdBySlugPath.get(path);
    if (sid == null) return "";
    const series = seriesById.get(sid);
    // 公開API /series と同じ退避: 表紙が未設定・削除済みなら先頭の写真を使う。
    const cover =
      series?.coverPhotoId != null
        ? photoById.get(series.coverPhotoId)
        : undefined;
    const pick = cover ?? photos.find((p) => p.seriesId === sid);
    if (!pick) return "";
    // photoAltText は title があればそれを、無ければシリーズ名と撮影者から
    // 文を作る。だから今日から無題ではなくなり、後でタイトルを入れれば
    // そのまま良くなる。
    return imageTag(
      pick.url,
      photoAltText(pick, { photographerName, seriesName: series?.title }),
    );
  };

  // lastmod は以前、全URLに毎回「今日」を入れていた。常に今日である日付は
  // 日付が無いのと区別できないので、**実際に分かる所にだけ出す**。
  // lastmod は必須要素ではない。
  let latestOverall: Date | null = null;
  const latestBySeries = new Map<number, Date>();
  for (const p of photos) {
    if (!p.createdAt) continue;
    if (!latestOverall || p.createdAt > latestOverall)
      latestOverall = p.createdAt;
    if (p.seriesId == null) continue;
    const current = latestBySeries.get(p.seriesId);
    if (!current || p.createdAt > current)
      latestBySeries.set(p.seriesId, p.createdAt);
  }
  const lastmodFor = (path: string): string => {
    if (path === "/" || path === "/gallery" || path === "/series")
      return isoDay(latestOverall);
    const sid = seriesIdBySlugPath.get(path);
    if (sid != null) return isoDay(latestBySeries.get(sid) ?? latestOverall);
    return "";
  };

  const urls = [...paths, ...seriesPaths]
    .map((p) => {
      const lastmod = lastmodFor(p);
      const changefreq = p === "/" || p === "/gallery" ? "weekly" : "monthly";
      return `  <url><loc>${siteUrl}${p}</loc>${
        lastmod ? `<lastmod>${lastmod}</lastmod>` : ""
      }<changefreq>${changefreq}</changefreq><priority>${
        p === "/" ? "1.0" : "0.7"
      }</priority>${imagesFor(p)}</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
}
