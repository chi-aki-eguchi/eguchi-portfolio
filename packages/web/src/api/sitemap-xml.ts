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
  /** 撮影日。題の無い写真の説明文を、撮った時期で見分けられるようにする。 */
  shotAt?: string | Date | null;
  sortOrder?: number | null;
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

  // 2026-08-14 のオーナー判断: /gallery に全公開写真569件をぶら下げていたのを
  // やめ、「シリーズの表紙」と「プロフィール写真」だけに絞った。理由は2つで、
  // (1) 題の無い画像は順位が付かない (2) 並びから1枚だけ剥がして配ることになる。
  //
  // 2026-09-01、(1) の前提が変わった。`photoAltText` が撮影時期を入れるように
  // なり、題の無い写真にも1枚ごとに違う説明文が付く。(2) のほうは、**その
  // シリーズの写真を、そのシリーズのページに付ける**ことで解いた——1枚だけ
  // 剥がして配るのではなく、束ねているページの中身として出す。
  // `/gallery` に全件をぶら下げるのは、いまも やらない。
  //
  // **サイトマップから外すのは「推さない」であって「遮断」ではない**
  // （巡回で見つかる経路は残る）。
  //
  // 1つのURLに付けられる画像は1000枚まで（Google の上限）。ここは十分下で
  // 止めておく——シリーズが巨大化したとき、サイトマップ1本が肥大するのを
  // 避けるため。
  // 反映後の実測（2026-09-01）: 画像は4枚→75枚になったが、**説明文はシリーズ内で
  // 2種類にしかならない**（Ishigaki Island 60枚が2024年8月と2025年8月の2つだけ）。
  // シリーズは撮影期間が短いので、撮影月ではほとんど分かれない。
  // **ここで連番を足して一意にしない。**「59枚中12枚目」は画像の内容を何も
  // 説明しておらず、検索向けに一意な文字列を作るのは説明ではなく細工になる。
  // 説明文が繰り返すのは、題と撮影地が空という同じ問題が出ているだけ。
  const MAX_IMAGES_PER_SERIES = 200;
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
    // 表紙を先頭に、そのシリーズの写真をページの中身として並べる。
    // 表紙が未設定・削除済みなら先頭の写真がそのまま先頭になる。
    const members = photos.filter((p) => p.seriesId === sid);
    const ordered = cover
      ? [cover, ...members.filter((p) => p.id !== cover.id)]
      : members;
    if (ordered.length === 0) return "";
    // photoAltText は title があればそれを、無ければシリーズ名・撮影者・
    // 撮影時期から文を作る。後でタイトルを入れれば、そのまま良くなる。
    return ordered
      .slice(0, MAX_IMAGES_PER_SERIES)
      .map((p) =>
        imageTag(
          p.url,
          photoAltText(p, { photographerName, seriesName: series?.title }),
        ),
      )
      .join("");
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
