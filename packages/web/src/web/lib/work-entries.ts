/**
 * 「作品を見に行く」入口をどこへ向けるか。
 *
 * TOP の「すべての作品を見る」は Gallery へ固定だった。Gallery が
 * `galleryExcludeSeries=on` で、どこの組にも属さない写真が1枚も無いと、
 * その先は案内だけのページになる（2026-09-16 の本番がその状態）。**見られる
 * 作品があるなら、そこへ直接送る。**
 *
 * 規則は1つにまとめる。TOP には表示方式が4つあり、それぞれに同じリンクが
 * 置かれているので、片方だけ直すと見え方によって行き先が変わる。
 *
 * 数えるのは共通ナビと同じ `/api/photos/availability`。新しい設定も、
 * 新しい問い合わせも足さない。
 */

export type PhotoCounts = { total: number; standalone: number };

/**
 * Gallery に並べる写真があるか。
 *
 * **取得中・失敗（`undefined`）を「0枚」にしない。** 数が分からないときに
 * 入口を作り替えると、通信が一度つまずいただけで行き先が変わる。
 */
export function galleryHasPhotos(
  counts: PhotoCounts | undefined,
  excludeSeries: boolean,
): boolean {
  if (!counts) return true;
  return (excludeSeries ? counts.standalone : counts.total) > 0;
}

export type WorkEntry = {
  href: string;
  /** 文としての言い方（「すべての作品を見る」「シリーズを見る」）。 */
  label: string;
  /** 見出しの横に置く短い言い方（「View all →」「Series →」）。 */
  shortLabel: string;
};

export function workEntries(input: {
  counts: PhotoCounts | undefined;
  galleryExcludeSeries: boolean;
  seriesCount: number;
  workCount: number;
  /** 同じページに Series の帯が出ているか（出ていれば入口が重なる）。 */
  seriesNearby: boolean;
  settings: Record<string, string | undefined> | undefined;
}): WorkEntry[] {
  const { counts, galleryExcludeSeries, seriesCount, workCount, seriesNearby, settings } = input;
  if (galleryHasPhotos(counts, galleryExcludeSeries)) {
    return [
      {
        href: "/gallery",
        label: settings?.viewAllCtaLabel || "すべての作品を見る",
        shortLabel: settings?.viewAllLabel ?? "View all →",
      },
    ];
  }
  const entries: WorkEntry[] = [];
  // 帯でシリーズを流している場所へ「シリーズを見る」を足さない。同じ行き先の
  // 入口が並ぶだけで、写真より操作が目立つ。
  if (seriesCount > 0 && !seriesNearby)
    entries.push({ href: "/series", label: "シリーズを見る", shortLabel: "Series →" });
  if (workCount > 0) {
    const workLabel = settings?.navLabelWork || "Work";
    entries.push({
      href: "/work",
      label: `${workLabel}を見る`,
      shortLabel: `${workLabel} →`,
    });
  }
  // 見に行ける作品がどこにも無ければ、入口そのものを出さない。
  return entries;
}
