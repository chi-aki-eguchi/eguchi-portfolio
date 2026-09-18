/**
 * 写真から「この写真が入っている作品群」へ戻るための対応表。
 *
 * 作品群は棚が2つある（`series` と `work`）。URL は棚で変わり、**サーバーは
 * 棚の違う URL を 404 で返す**（`/series/rintaro` は 404、`/work/rintaro` は
 * 200。`api/public-routes.ts` の `seriesDetailRoute`）。それなのに
 * トップとギャラリーは `/api/series`（= Series 棚だけ）で対応表を作り、
 * ビューアのキャプションは行き先を `/series/<slug>` と決め打ちにしていた。
 *
 * 結果、2026-09-19 の本番では **公開写真133枚のうち Work 棚の101枚（76%）が、
 * 拡大して見たあと「どの作品の1枚なのか」も分からず、作品ページへ戻る道も
 * 無かった**。Series 棚の32枚だけがリンクを持っていた。
 *
 * 棚と slug の両方を持った1つの対応表にして、行き先は棚から決める。
 */
export type SeriesLink = {
  /** 作品群の名前。写真の説明文（alt）にも使う。 */
  name: string;
  /** その作品群のページ。棚に合った URL。 */
  href: string;
};

type SeriesRow = {
  id: number;
  slug: string;
  title: string;
  kind?: string | null;
};

/** 作品群1本ぶんの公開URL。`kind` が無い古い応答は Series 棚として扱う。 */
export function seriesHref(row: { slug: string; kind?: string | null }): string {
  const shelf = row.kind === "work" ? "work" : "series";
  return `/${shelf}/${encodeURIComponent(row.slug)}`;
}

/**
 * 2つの棚をまとめて id → { name, href } にする。
 *
 * 同じ id が両方に出ることは無いが、来たとしても先に渡した棚を優先して
 * 上書きしない（呼び出し側の読み込み順で行き先が変わらないように）。
 */
export function seriesLinksById(
  ...shelves: (readonly SeriesRow[] | undefined)[]
): Record<number, SeriesLink> {
  const map: Record<number, SeriesLink> = {};
  for (const rows of shelves) {
    for (const row of rows ?? []) {
      if (row.id in map) continue;
      map[row.id] = { name: row.title, href: seriesHref(row) };
    }
  }
  return map;
}
