/**
 * 展示の欄（2026-11-10、新しい構成のとき）。
 *
 * 展示は1件ずつのページ（`/exhibition/:slug`）になり、`/exhibition` に一覧が並ぶ。トップは
 * いつもの表紙に戻し、展示は終わったあとも記録としてここに残る（オーナー「今までの展示もこの形式で
 * 残せるかな？」）。
 *
 * - 日藝祭 2026（`shared/exhibition.ts`）は今までの設定（exhibitionTitle など）と同梱の写真のまま、
 *   最初の1件になる。会場の壁の配置・名刺・QR の人への部分も、そのページにそのまま付く。
 * - ほかの展示（前の展示・次の展示）は、設定 `exhibitionArchive` に JSON の並びで入る。
 *   写真はライブラリの写真を選ぶ。先頭の写真が表紙になり、選んだ順に続き、最後に添える文。
 * - 並びは新しい順。会期の文から年と月を読む（「2025年10月」「2025.10」「2025」）。読めない物は後ろ。
 * - 写真が1枚も無い展示は、公開の一覧にもページにも出さない（管理画面には出る）。
 */
import { isDevelopDesignValue, parsePhotoIdList } from "./develop-structure";
import {
  EXHIBITION_DATES_MAX,
  EXHIBITION_DEFAULTS,
  EXHIBITION_TEXT_MAX,
  EXHIBITION_TITLE_MAX,
  exhibitionPhotoList,
  readExhibitionCaptions,
  type ExhibitionPhoto,
} from "./exhibition";
import { isServiceOwnerSite } from "./service-visibility";

export const EXHIBITION_LIST_PATH = "/exhibition";
/** 日藝祭 2026 のページ。名刺の QR（`/card.html`）は、トップが展示でない間ここへ通す。 */
export const EXHIBITION_NICHIGEI_SLUG = "2026-nichigei";
/** メニューと一覧の見出しの言葉。 */
export const EXHIBITION_NAV_LABEL = "Exhibition";
/** 足せる展示の数。 */
export const EXHIBITION_ARCHIVE_MAX = 40;

export function exhibitionPath(slug: string): string {
  return `${EXHIBITION_LIST_PATH}/${slug}`;
}

/** `/exhibition/:slug` の slug。展示のページでなければ null。 */
export function exhibitionSlugFromPath(pathname: string): string | null {
  const match = pathname.replace(/\/+$/, "").match(/^\/exhibition\/([a-z0-9-]{1,40})$/);
  return match ? match[1]! : null;
}

/** 足した展示（設定 `exhibitionArchive` の1件）。 */
export type ExhibitionRecord = {
  slug: string;
  title: string;
  dates: string;
  text: string;
  /** ライブラリの写真の ID を、出す順にコンマで。 */
  photoIds: string;
  /** 写真ごとの題（`exhibitionCaptions` と同じ形の JSON）。 */
  captions: string;
};

export type ExhibitionEntry = ExhibitionRecord & {
  /** 日藝祭 2026（同梱の写真・壁の配置・名刺が付く）。 */
  builtIn: boolean;
  /** 名刺の QR から来た人へのひとこと（日藝祭だけ）。 */
  thanks: string;
};

type SettingsLike = Record<string, string | null | undefined> | null | undefined;

function tidyLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, max).join("");
}

function tidyText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n?/g, "\n").trim();
  return Array.from(text).slice(0, max).join("");
}

function validSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value) && value !== EXHIBITION_NICHIGEI_SLUG;
}

/** 設定の文字列から、足した展示を読む。壊れた値・同じ slug の2件目・形の違う物は無かったことにする。 */
export function readExhibitionArchive(value: string | null | undefined): ExhibitionRecord[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const list: ExhibitionRecord[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (!validSlug(raw.slug) || seen.has(raw.slug)) continue;
    seen.add(raw.slug);
    list.push({
      slug: raw.slug,
      title: tidyLine(raw.title, EXHIBITION_TITLE_MAX),
      dates: tidyLine(raw.dates, EXHIBITION_DATES_MAX),
      text: tidyText(raw.text, EXHIBITION_TEXT_MAX),
      photoIds: parsePhotoIdList(typeof raw.photoIds === "string" ? raw.photoIds : "")
        .filter((id) => id > 0)
        .join(","),
      captions: (() => {
        const captions = readExhibitionCaptions(typeof raw.captions === "string" ? raw.captions : "");
        return Object.keys(captions).length > 0 ? JSON.stringify(captions) : "";
      })(),
    });
    if (list.length >= EXHIBITION_ARCHIVE_MAX) break;
  }
  return list;
}

/** 保存する文字列（1件も無ければ空）。 */
export function writeExhibitionArchive(list: readonly ExhibitionRecord[]): string {
  const tidy = readExhibitionArchive(JSON.stringify(list));
  return tidy.length > 0 ? JSON.stringify(tidy) : "";
}

/** 新しい展示の slug。会期の年が読めればそれを頭に付ける（住所から、いつの展示か分かるように）。 */
export function newExhibitionSlug(taken: readonly string[], seed: string, dates = ""): string {
  const year = dates.match(/(?:19|20)\d\d/)?.[0];
  const tail = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6) || "x";
  const base = year ? `${year}-${tail}` : `ex-${tail}`;
  let slug = base;
  for (let n = 2; taken.includes(slug) || slug === EXHIBITION_NICHIGEI_SLUG; n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * 並べるための数（年×100＋月）。会期の文から読む。全角の数字も読む。読めなければ 0（後ろへ）。
 * 「日藝祭 2026年11月1日〜3日」→ 202611、「2025.10.3–5」→ 202510、「2024」→ 202400。
 */
export function exhibitionSortKey(dates: string): number {
  const half = dates.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const match = half.match(/((?:19|20)\d\d)(?:\s*[年./-]\s*(\d{1,2}))?/);
  if (!match) return 0;
  const month = match[2] ? Number(match[2]) : 0;
  return Number(match[1]) * 100 + (month >= 1 && month <= 12 ? month : 0);
}

/**
 * 日藝祭 2026 を持つサイトか（持ち主のサイト。トップを展示にしているサイトも含む）。
 * site は、画面なら開いている場所の名前（hostname）、サーバーならサイトの住所（保存値が無いときの補い込み）。
 */
function hasBuiltInExhibition(settings: SettingsLike, site: string | undefined): boolean {
  return (
    settings?.exhibitionOnTop === "on" ||
    isServiceOwnerSite(settings?.siteUrl ?? undefined, site) ||
    isServiceOwnerSite(site, undefined)
  );
}

/**
 * このサイトの展示を、新しい順に。新しい構成のサイトにだけ在る。
 * 写真の無い展示も含む（管理画面用）。公開に出す物は `exhibitionIsPublic` で選ぶ。
 */
export function exhibitionEntries(settings: SettingsLike, site?: string): ExhibitionEntry[] {
  if (!settings || !isDevelopDesignValue(settings.siteDesign)) return [];
  const entries: ExhibitionEntry[] = readExhibitionArchive(settings.exhibitionArchive).map((record) => ({
    ...record,
    builtIn: false,
    thanks: "",
  }));
  if (hasBuiltInExhibition(settings, site)) {
    entries.push({
      slug: EXHIBITION_NICHIGEI_SLUG,
      title: settings.exhibitionTitle ?? EXHIBITION_DEFAULTS.title,
      dates: settings.exhibitionDates ?? EXHIBITION_DEFAULTS.dates,
      text: settings.exhibitionText ?? EXHIBITION_DEFAULTS.text,
      photoIds: settings.exhibitionPhotoIds ?? "",
      captions: settings.exhibitionCaptions ?? "",
      builtIn: true,
      thanks: settings.exhibitionThanks ?? EXHIBITION_DEFAULTS.thanks,
    });
  }
  // 同じ月の物は、足した順（新しく足した物が前）のまま。
  return entries
    .map((entry, index) => ({ entry, index, key: exhibitionSortKey(entry.dates) }))
    .sort((a, b) => b.key - a.key || a.index - b.index)
    .map(({ entry }) => entry);
}

/** 公開に出せる展示か。同梱の展示は写真が必ずある。足した展示は、写真を1枚でも選んでから。 */
export function exhibitionIsPublic(entry: ExhibitionEntry): boolean {
  return entry.builtIn || parsePhotoIdList(entry.photoIds).length > 0;
}

export function publicExhibitions(settings: SettingsLike, site?: string): ExhibitionEntry[] {
  return exhibitionEntries(settings, site).filter(exhibitionIsPublic);
}

/**
 * その展示に出す写真。同梱の展示は今までどおり（空なら同梱の5枚）。足した展示はライブラリの写真だけで、
 * 公開していない・消した写真は飛ばす（1枚も残らなければ空）。
 */
export function exhibitionEntryPhotos<T extends { id: number }>(
  entry: ExhibitionEntry,
  library: readonly T[],
): (T | ExhibitionPhoto)[] {
  if (entry.builtIn) return exhibitionPhotoList(entry.photoIds, library);
  const byId = new Map(library.map((photo) => [photo.id, photo]));
  return parsePhotoIdList(entry.photoIds)
    .map((id) => byId.get(id))
    .filter((photo): photo is T => Boolean(photo));
}

/** 一覧やページの題。題の無い展示は会期を、どちらも無ければ「展示」。 */
export function exhibitionDisplayTitle(entry: Pick<ExhibitionRecord, "title" | "dates">): string {
  return entry.title || entry.dates || "展示";
}
