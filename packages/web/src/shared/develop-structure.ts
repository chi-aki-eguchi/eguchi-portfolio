/**
 * 新しい構成（siteDesign = "develop"、2026-10-10）で API と画面の両方が使う決まり。
 *
 * 扉は Portrait／Life／Series／Info の4つ。今までのページ（Gallery・Series・Work・
 * About・Contact・英語・方針）は無くさず、同じ住所でそのまま開ける。
 * 増えるのは下の3つの住所だけで、今までの構成のサイトでは今までどおり 404。
 */
export const DEVELOP_ONLY_PATHS = ["/portrait", "/life", "/info"] as const;

export function isDevelopDesignValue(value: string | null | undefined): boolean {
  return value === "develop";
}

export function isDevelopOnlyPath(pathname: string): boolean {
  return (DEVELOP_ONLY_PATHS as readonly string[]).includes(pathname);
}

export type DevelopListKind = "portrait" | "life";

/** "12, 7,12 ,x" → [12, 7]。重複は最初の1つを残す（`web/lib/top-works-ids.ts` と同じ読み方）。 */
export function parsePhotoIdList(value: string | null | undefined): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of (value ?? "").split(",")) {
    const id = parseInt(part.trim(), 10);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Portrait／Life に出す写真。
 *
 * 1. 選んだ写真があれば（設定 `developPortraitIds`／`developLifeIds`）、その写真を選んだ順で。
 *    公開していない・消した写真のIDは飛ばす。
 * 2. 選んでいなければ（または選んだ写真が1枚も残っていなければ）写真の分類から出す：
 *    Portrait は分類が portrait の写真、Life は portrait 以外の分類が付いた写真
 *    （life・nature など）。分類の無い写真はどちらにも出さない（全部の写真は Gallery）。
 *    並びは渡された順のまま（呼ぶ側が管理画面の並び順で渡す）。
 */
export function developListPhotos<T extends { id?: number; category?: string | null }>(
  kind: DevelopListKind,
  photos: T[],
  picked?: string | null,
): T[] {
  const ids = parsePhotoIdList(picked);
  if (ids.length > 0) {
    const byId = new Map(photos.map((p) => [p.id, p]));
    const chosen = ids.map((id) => byId.get(id)).filter((p): p is T => Boolean(p));
    if (chosen.length > 0) return chosen;
  }
  return photos.filter((p) => {
    const c = (p.category ?? "").trim();
    return kind === "portrait" ? c === "portrait" : c !== "" && c !== "portrait";
  });
}
