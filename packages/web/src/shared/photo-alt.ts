// Meaningful alt/aria-label text for photos without an admin-set title. A raw
// filename or a generic "Photograph N" placeholder is useless to screen readers
// and search engines — fall back through description, then a Japanese sentence
// built from whatever context (series / category / photographer) is available.
export interface AltTextPhoto {
  title?: string | null;
  description?: string | null;
  /** 撮影日。題も説明も無い写真を、せめて撮った時期で見分けられるようにする。 */
  shotAt?: string | Date | null;
  /**
   * "フィルム" | "デジタル" | 未設定。
   *
   * **フィルムの `shotAt` は撮影日ではない。** 取り込みはフィルムをカメラで
   * 複写する方式なので、EXIF の DateTimeOriginal に入っているのは複写（スキャン）
   * した時刻で、シャッターを切った日ではない（取り込みの仕様、2026-09-13）。
   * ビューアの撮影情報は既にこれを区別して "Scanned" と出しているのに、
   * 説明文だけが「○年○月に撮影」と言っていた。
   */
  filmType?: string | null;
}

export interface AltTextContext {
  photographerName?: string | null;
  seriesName?: string | null;
  categoryLabel?: string | null;
}

export function photoAltText(
  photo: AltTextPhoto,
  ctx: AltTextContext = {},
): string {
  const title = photo.title?.trim();
  if (title) return title;
  const description = photo.description?.trim();
  if (description) return description;
  const photographer = ctx.photographerName?.trim();
  const category = ctx.categoryLabel?.trim();
  const series = ctx.seriesName?.trim();
  const when = shotAtLabel(photo.shotAt);
  const isFilm = photo.filmType?.trim() === "フィルム";
  // フィルムは「何の写真か」を medium で、「いつか」を複写の時期として添える。
  // 撮影の時期は分からないので、分かるふりをしない。
  const subject = isFilm
    ? category
      ? `${category}のフィルム写真`
      : "フィルム写真"
    : category
      ? `${category}写真`
      : "写真";
  const bySomeone = photographer ? `${photographer}撮影の${subject}` : subject;
  const scanned = isFilm && when ? `（${when}スキャン）` : "";

  // 撮影時期を入れる。**入れないと、同じシリーズの写真が全部まったく同じ
  // 一文になる**（2026-09-01 実測: 公開写真497枚のうち題・説明が入っている
  // ものは0件。Ishigaki Island の59枚は59枚とも同じ alt だった）。
  // 画像検索は、区別のつかない同じ文が並んだ束を並べ替えようがない。
  //
  // フィルムでない写真の `shotAt` はカメラの DateTimeOriginal（＝撮影時刻）
  // なので、従来どおり「○年○月に撮影」と言える。medium が未設定の写真も
  // 同じ扱い——この欄が空なのはカメラ由来の写真のほうなので、ここを
  // 「不明」に倒すと、実際に撮影日を持つ写真の説明まで区別を失う。
  const body = !isFilm && when ? `${when}に撮影` : "";
  if (series) {
    return body
      ? `${series}シリーズより、${photographerPrefix(photographer)}${body}した${subject}`
      : `${series}シリーズより、${bySomeone}${scanned}`;
  }
  return body
    ? `${photographerPrefix(photographer)}${body}した${subject}`
    : `${bySomeone}${scanned}`;
}

// 「江口秋が」/ 撮影者不明なら空。文の骨格を1か所に寄せる。
function photographerPrefix(photographer?: string): string {
  return photographer ? `${photographer}が` : "";
}

/**
 * 「2024年8月」。日付として読めなければ空文字。
 *
 * 日だけは出さない。1日に何十枚も撮る日があり、日まで出しても区別は増えず、
 * 撮影地の特定につながる粒度を人手の確認なしに公開することになる。
 */
function shotAtLabel(shotAt?: string | Date | null): string {
  if (!shotAt) return "";
  const d = shotAt instanceof Date ? shotAt : new Date(shotAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
