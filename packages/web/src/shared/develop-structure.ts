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

/**
 * Portrait／Life に出す写真。第1段階では写真の分類から出す：
 * Portrait は分類が portrait の写真、Life は portrait 以外の分類が付いた写真
 * （life・nature など）。分類の無い写真はどちらにも出さない（全部の写真は Gallery）。
 * 並びは渡された順のまま（呼ぶ側が Gallery と同じ並べ方で渡す）。
 */
export function developListPhotos<T extends { category?: string | null }>(
  kind: DevelopListKind,
  photos: T[],
): T[] {
  return photos.filter((p) => {
    const c = (p.category ?? "").trim();
    return kind === "portrait" ? c === "portrait" : c !== "" && c !== "portrait";
  });
}
