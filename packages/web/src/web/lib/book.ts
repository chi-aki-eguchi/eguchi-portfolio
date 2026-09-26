/**
 * 写真集の骨格（siteDesign = "book"、2026-09-23 試作）で使う計算だけを置く。
 *
 * - シリーズの写真の並びは、作品ページ・トップの章・目次（ベタ焼き）で
 *   **同じ関数**から出す。ページ番号「07 / 32」とベタ焼きのコマ番号が
 *   食い違うと、目次から開いた先が別の写真になる。
 * - フィルムとデジタルは写真1枚ずつの `filmType` に従う。デジタルの写真を
 *   フィルムらしく見せる分け方はしない。
 * - フィルムの `shotAt` は複写した日時なので、期間はデジタルの撮影日からだけ
 *   組む（31f079c と同じ判断）。
 */
import { sortPhotosBySetting } from "./photo-sort";
import {
  isMeaningfulGear,
  tidyCameraName,
} from "./series-colophon";
import type { GalleryPhoto } from "../components/PhotoGallery";

export const SITE_DESIGNS = ["classic", "book"] as const;
export type SiteDesign = (typeof SITE_DESIGNS)[number];

export function siteDesignFrom(value: string | null | undefined): SiteDesign {
  return value === "book" ? "book" : "classic";
}

/**
 * Gallery（写真集では Photos）から、作品に入っている写真を外すか。
 *
 * 写真集では外さない。Photos は「作品に入っているものも入っていないものも、
 * すべての写真」を見る場所（2026-09-26 オーナー「写真をいっぱい見られるように」）。
 * 設定 `galleryExcludeSeries` はいつもの構成の Gallery のためのもので、
 * 本番は全部の写真が作品に入っているため、写真集で従うと Photos が消えていた。
 */
export function galleryExcludesSeries(
  settings: { siteDesign?: string | null; galleryExcludeSeries?: string | null } | null | undefined,
): boolean {
  if (siteDesignFrom(settings?.siteDesign) === "book") return false;
  return (settings?.galleryExcludeSeries ?? "off") === "on";
}

/**
 * 写真集の器を使わない経路。制作サービスの案内・管理画面は別の仕事の
 * ページなので、今までどおりの上の帯で描く。
 */
const CLASSIC_CHROME_PREFIXES = [
  "/admin",
  "/portfolio-kit",
  "/start",
  "/service",
  "/tools",
];

export function usesBookChrome(
  design: SiteDesign,
  location: string,
): boolean {
  if (design !== "book") return false;
  return !CLASSIC_CHROME_PREFIXES.some(
    (p) => location === p || location.startsWith(`${p}/`),
  );
}

type OrderSettings = { seriesSortOrder?: string | null } | undefined;

/** 作品ページ（series-detail.tsx）と同じ規則で並べる。 */
export function orderedSeriesPhotos<T extends GalleryPhoto>(
  detail: { series: { themeConfig?: string | null }; photos: T[] },
  settings: OrderSettings,
): T[] {
  let themeConfig: Record<string, string> = {};
  try {
    themeConfig = detail.series.themeConfig
      ? (JSON.parse(detail.series.themeConfig) as Record<string, string>)
      : {};
  } catch {
    themeConfig = {};
  }
  const photoOrder =
    themeConfig.photoOrder &&
    themeConfig.photoOrder !== "inherit" &&
    themeConfig.photoOrder !== "manual_inherit"
      ? themeConfig.photoOrder
      : (settings?.seriesSortOrder ?? undefined);
  return sortPhotosBySetting(detail.photos, photoOrder);
}

export type Medium = "film" | "digital" | "unknown";

export function mediumOf(photo: { filmType?: string | null }): Medium {
  if (photo.filmType === "フィルム") return "film";
  if (photo.filmType === "デジタル") return "digital";
  return "unknown";
}

export type MediumRun<T> = {
  medium: Medium;
  /** 0 始まり。コマ番号は start + i + 1。 */
  start: number;
  photos: T[];
};

/** 続けて並ぶ同じ媒体の写真をひとまとまりにする（ベタ焼きの帯）。 */
export function mediumRuns<T extends { filmType?: string | null }>(
  photos: T[],
): MediumRun<T>[] {
  const runs: MediumRun<T>[] = [];
  photos.forEach((photo, i) => {
    const medium = mediumOf(photo);
    const last = runs[runs.length - 1];
    if (last && last.medium === medium) last.photos.push(photo);
    else runs.push({ medium, start: i, photos: [photo] });
  });
  return runs;
}

export type BookFacts = {
  count: number;
  film: number;
  digital: number;
  cameras: string[];
  /** デジタルの撮影日だけから組んだ期間。無ければ null。 */
  digitalPeriod: string | null;
};

function yearMonth(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec((value ?? "").trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

function formatMonths(months: string[]): string | null {
  if (months.length === 0) return null;
  const sorted = [...months].sort();
  const [fy, fm] = sorted[0]!.split("-") as [string, string];
  const [ly, lm] = sorted[sorted.length - 1]!.split("-") as [string, string];
  const head = `${Number(fy)}.${Number(fm)}`;
  if (sorted[0] === sorted[sorted.length - 1]) return head;
  return `${head}–${Number(ly)}.${Number(lm)}`;
}

export function bookFacts(
  photos: {
    filmType?: string | null;
    camera?: string | null;
    shotAt?: string | null;
  }[],
): BookFacts {
  const cameras = new Set<string>();
  let film = 0;
  let digital = 0;
  const months: string[] = [];
  for (const p of photos) {
    const m = mediumOf(p);
    if (m === "film") film++;
    if (m === "digital") {
      digital++;
      const ym = yearMonth(p.shotAt);
      if (ym) months.push(ym);
    }
    if (isMeaningfulGear(p.camera)) cameras.add(tidyCameraName(p.camera!));
  }
  return {
    count: photos.length,
    film,
    digital,
    cameras: [...cameras].sort((a, b) => a.localeCompare(b)),
    digitalPeriod: formatMonths(months),
  };
}

/** 「フィルム 32」「デジタル 94 ・ フィルム 7」 */
export function mediumLine(facts: BookFacts, language: "ja" | "en"): string {
  const parts: string[] = [];
  const film = language === "ja" ? "フィルム" : "Film";
  const digital = language === "ja" ? "デジタル" : "Digital";
  if (facts.film > 0 && facts.digital === 0) return film;
  if (facts.digital > 0 && facts.film === 0) return digital;
  if (facts.digital > 0) parts.push(`${digital} ${facts.digital}`);
  if (facts.film > 0) parts.push(`${film} ${facts.film}`);
  return parts.join(" ・ ");
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `#p-07` → 6（0 始まり）。形が違えば null。 */
export function pageIndexFromHash(hash: string): number | null {
  const m = /^#p-(\d{1,4})$/.exec(hash);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n - 1 : null;
}

export function pageHash(index: number): string {
  return `p-${pad2(index + 1)}`;
}
