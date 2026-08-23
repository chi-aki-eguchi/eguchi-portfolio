/**
 * 作品群が、自分がどう作られたかを述べるための事実。
 *
 * 写真には撮影日・媒体・カメラ・レンズが入っているのに、公開サイトはそれを
 * 一枚ずつのビューアの中でしか見せていなかった。**作品群としての事実を
 * どこにも言っていない。** 実測（2026-08-23 / `ishigakiisland`）では59点
 * すべてに camera・lens・shotAt が入っており、カメラは1台、レンズは4本、
 * 撮影は2024年8月からだった。奥付として述べるに足る。
 *
 * ここは計算だけを持つ。**新しい入力欄も新しい通信も足さない** —— すべて
 * そのページが既に読み込んでいる写真から出す。
 */

export type ColophonPhoto = {
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
  shotAt?: string | null;
};

export type Colophon = {
  count: number;
  /** 「2024年8月」「2024年8月–11月」「2024年8月–2025年3月」 */
  period: string | null;
  /** 「フィルム」「デジタル」「フィルム・デジタル」 */
  medium: string | null;
  cameras: string[];
  lenses: string[];
  /** 一覧に載せきらなかったレンズの本数。0 なら省略なし。 */
  lensesOmitted: number;
};

/** これ以上並べると事実の列挙ではなく機材自慢になる。 */
const MAX_LENSES = 5;

/**
 * Sigma のレンズは EXIF の LensModel に製品ラインの型番まで載せてくる
 * （`24-70mm F2.8 DG DN | Art 019`）。奥付では `|` が並列の中点と
 * ぶつかって読みにくいうえ、型番は作品の事実ではない。
 *
 * **末尾の Art / Sports / Contemporary + 数字だけを落とす。** それ以外の
 * `|` には触れない —— 他社が別の意味で使っている可能性があり、
 * 買った人のレンズ名を勝手に削るほうが害が大きい。
 */
const SIGMA_LINE_CODE = /\s*\|\s*(?:Art|Sports|Contemporary)\s*\d+\s*$/i;

export function tidyLensName(name: string): string {
  return name.replace(SIGMA_LINE_CODE, "").trim();
}

/**
 * `shotAt` から年月だけを正規表現で取る。**`new Date()` を通さない。**
 * 保存値は `2024-08-19T13:47:04` のようにタイムゾーンを持たないため、
 * Date にすると環境のタイムゾーンで解釈され、月末の1枚が隣の月へ動く。
 */
function yearMonth(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec((value ?? "").trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

function formatPeriod(months: string[]): string | null {
  if (months.length === 0) return null;
  const sorted = [...months].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const [fy, fm] = first.split("-") as [string, string];
  const [ly, lm] = last.split("-") as [string, string];
  const head = `${Number(fy)}年${Number(fm)}月`;
  if (first === last) return head;
  if (fy === ly) return `${head}–${Number(lm)}月`;
  return `${head}–${Number(ly)}年${Number(lm)}月`;
}

function distinct(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t) seen.add(t);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "ja"));
}

export function seriesColophon(photos: ColophonPhoto[]): Colophon | null {
  if (photos.length === 0) return null;
  const months = photos
    .map((p) => yearMonth(p.shotAt))
    .filter((m): m is string => m !== null);
  const cameras = distinct(photos.map((p) => p.camera));
  const allLenses = distinct(
    photos.map((p) => (p.lens ? tidyLensName(p.lens) : p.lens)),
  );
  const mediums = distinct(photos.map((p) => p.filmType));

  return {
    count: photos.length,
    period: formatPeriod(months),
    medium: mediums.length ? mediums.join("・") : null,
    cameras,
    lenses: allLenses.slice(0, MAX_LENSES),
    lensesOmitted: Math.max(0, allLenses.length - MAX_LENSES),
  };
}

/**
 * 述べることが枚数しか無いなら、奥付を出さない。
 * 「59点」だけの一行は、事実ではなく余りに見える。
 */
export function colophonHasSubstance(c: Colophon | null): boolean {
  if (!c) return false;
  return Boolean(
    c.period || c.medium || c.cameras.length > 0 || c.lenses.length > 0,
  );
}
