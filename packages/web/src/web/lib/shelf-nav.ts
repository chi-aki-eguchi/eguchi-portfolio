/**
 * 棚（シリーズ / Work）をナビに出すかどうか。
 *
 * 規則は3択（`"on"` / `"off"` / それ以外＝自動）。**自動のときは、中身が
 * 1本でもあれば出す。** 空の棚をナビに出すと、押した先が空っぽで、
 * 「作りかけのサイト」に見える。
 *
 * シリーズと Work で同じ規則を使う。同じ判断を2か所に書くと、片方だけ
 * 直して食い違う（2026-08-30、Work の棚を足したときに1つにまとめた）。
 */
export function shouldShowShelf(
  setting: string | undefined | null,
  publishedCount: number,
): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return publishedCount > 0;
}

/** 自動のときだけ中身を数えに行けばよい（`on`/`off` は数を見ない）。 */
export function shelfNeedsCount(setting: string | undefined | null): boolean {
  return setting !== "on" && setting !== "off";
}
