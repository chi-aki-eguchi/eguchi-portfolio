// `/photo/:id`（写真1枚ぶんの着地ページ）の言葉を組み立てる。
//
// **なぜこのページが要るか。**まとまった作品ページだけでは、画像検索や共有から
// 個々の写真へ直接着地できない。1枚ごとに固有の住所を持たせつつ、編集前の薄い
// ページは検索対象にしない。
//
// ここは純粋関数だけにして、DB も Hono も持ち込まずにテストできるようにする
// （`ogp.ts` / `server.ts` と同じ分け方）。

import { photoAltText, type AltTextContext, type AltTextPhoto } from "./photo-alt";

export type PhotoPageInput = AltTextPhoto & {
  camera?: string | null;
  lens?: string | null;
  focalLength?: string | null;
  fNumber?: string | null;
  exposureTime?: string | null;
  iso?: string | null;
  filmType?: string | null;
};

export type PhotoIndexInput = Pick<
  PhotoPageInput,
  "title" | "description"
>;

const normalizeEditorialText = (value: string | null | undefined): string =>
  (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

/**
 * A photo detail route exists for sharing, but it becomes a search landing page
 * only after a person has actually edited it. Dates, EXIF and generated alt text
 * are useful accessibility fallbacks; they are not a substitute for a title and
 * a substantive, photo-specific caption.
 */
export function isIndexablePhoto(photo: PhotoIndexInput): boolean {
  const title = normalizeEditorialText(photo.title);
  const description = normalizeEditorialText(photo.description);
  return title.length >= 3 && description.length >= 30 && title !== description;
}

/**
 * Search candidates must also be unique inside the published collection. This
 * prevents a copied caption from turning dozens of otherwise valid routes into
 * duplicate landing pages.
 */
export function indexablePhotoIds<T extends PhotoIndexInput & { id: number }>(
  photos: readonly T[],
): Set<number> {
  const candidates = photos.filter(isIndexablePhoto);
  const titleCounts = new Map<string, number>();
  const descriptionCounts = new Map<string, number>();
  // Count against the whole published collection, not just otherwise eligible
  // candidates. A strong page must not reuse copy from a thin page either.
  for (const photo of photos) {
    const title = normalizeEditorialText(photo.title);
    const description = normalizeEditorialText(photo.description);
    if (title) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    if (description)
      descriptionCounts.set(
        description,
        (descriptionCounts.get(description) ?? 0) + 1,
      );
  }
  return new Set(
    candidates
      .filter(
        (photo) =>
          titleCounts.get(normalizeEditorialText(photo.title)) === 1 &&
          descriptionCounts.get(normalizeEditorialText(photo.description)) === 1,
      )
      .map((photo) => photo.id),
  );
}

/** Adjacent links stay inside the same curated set used by sitemap and robots. */
export function indexablePhotoNeighbours<
  T extends PhotoIndexInput & { id: number },
>(
  orderedPhotos: readonly T[],
  currentId: number,
): { prev: number | null; next: number | null } {
  const ids = indexablePhotoIds(orderedPhotos);
  const curated = orderedPhotos.filter((photo) => ids.has(photo.id));
  const index = curated.findIndex((photo) => photo.id === currentId);
  return {
    prev: index > 0 ? curated[index - 1]?.id ?? null : null,
    next:
      index >= 0 && index < curated.length - 1
        ? curated[index + 1]?.id ?? null
        : null,
  };
}

/**
 * 機材欄のゴミ値を落とす。**EXIF から入った値をそのまま出すと嘘になる。**
 * `----` や `0.0 mm f/0.0` はレンズ名ではなく「読めなかった」という意味の文字列。
 */
export function cleanGearValue(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/^-+$/.test(v)) return "";
  if (/^0(\.0+)?\s*mm(\s|$)/i.test(v)) return "";
  if (/^0(\.0+)?$/.test(v)) return "";
  return v;
}

/** 「SONY ILCE-1 / FE 50mm F1.2 GM / f1.2 / 1/2000秒 / ISO 100」 */
export function captureFacts(photo: PhotoPageInput): string[] {
  const out: string[] = [];
  const camera = cleanGearValue(photo.camera);
  const lens = cleanGearValue(photo.lens);
  if (camera) out.push(camera);
  if (lens) out.push(lens);
  const f = cleanGearValue(photo.fNumber);
  if (f) out.push(f.startsWith("f") ? f : `f${f}`);
  const shutter = cleanGearValue(photo.exposureTime);
  if (shutter) {
    const localized = shutter.replace(/\s*(?:s|sec)$/i, "秒");
    out.push(localized.endsWith("秒") ? localized : `${localized}秒`);
  }
  const iso = cleanGearValue(photo.iso);
  if (iso) out.push(iso.toUpperCase().startsWith("ISO") ? iso : `ISO ${iso}`);
  return out;
}

/**
 * ページの題。人が付けた題が無い場合は `photoAltText` の説明的な文へ退避する。
 * 退避した題は共有・アクセシビリティ用で、検索対象にする根拠には使わない。
 */
export function photoPageTitle(
  photo: PhotoPageInput,
  ctx: AltTextContext = {},
): string {
  return photoAltText(photo, ctx);
}

/**
 * 検索結果に出る一文。人が書いた説明を中心に、題に無い撮影事実も足す。
 * 説明も撮影事実も無いときは題を返す（空の description を出さない）。
 */
export function photoPageDescription(
  photo: PhotoPageInput,
  ctx: AltTextContext = {},
): string {
  const head = photoPageTitle(photo, ctx);
  const editorialDescription = (photo.description ?? "").trim();
  const parts: string[] = [];
  const film = (photo.filmType ?? "").trim();
  if (film) parts.push(film);
  parts.push(...captureFacts(photo));
  const lead = /[。.!?！？]$/.test(head) ? head : `${head}。`;
  const editorial =
    editorialDescription &&
    normalizeEditorialText(editorialDescription) !== normalizeEditorialText(head)
      ? /[。.!?！？]$/.test(editorialDescription)
        ? editorialDescription
        : `${editorialDescription}。`
      : "";
  const capture = parts.length ? `${parts.join(" / ")}。` : "";
  return `${lead}${editorial}${capture}`;
}

/**
 * JS を実行しないクローラに渡す段落。**画面には出ない**（`<noscript>` の中）。
 * 事実だけを短く並べる。ここで文章をでっち上げない。
 */
export function photoPageParagraphs(
  photo: PhotoPageInput,
  ctx: AltTextContext = {},
): string[] {
  const out: string[] = [];
  const editorialDescription = (photo.description ?? "").trim();
  if (
    editorialDescription &&
    normalizeEditorialText(editorialDescription) !==
      normalizeEditorialText(photoPageTitle(photo, ctx))
  ) {
    out.push(editorialDescription);
  }
  const series = (ctx.seriesName ?? "").trim();
  if (series) out.push(`シリーズ「${series}」の1枚。`);
  const film = (photo.filmType ?? "").trim();
  const facts = captureFacts(photo);
  if (film || facts.length) {
    out.push([film, ...facts].filter(Boolean).join(" / "));
  }
  return out;
}
