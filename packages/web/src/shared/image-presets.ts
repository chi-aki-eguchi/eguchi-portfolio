/**
 * 画像の幅と画質の組み合わせ（用途ごと）。
 *
 * **サーバーとクライアントの両方がここを使う。** 以前はこの表が
 * `web/lib/picture.ts` にあり、HTMLへ先読みタグを入れる `server.ts` は
 * 同じ数字を手で書き写していた。`server.ts` は `web/` を import しない境界に
 * あるためで、写した側は正しかったが**形式(avif/webp)と、作り置きサムネの
 * 存在**を写せておらず、先読みした8枚は1枚も使われていなかった。
 *
 * 数字ではなく関数を共有すれば、次に誰かが幅や画質を変えても両側が同時に動く。
 */
import {
  imageUrlWithParams,
  type ImageFormat,
  type RotationDeg,
} from "./image-url";

type SrcSetEntry = { w: number; q: number };

const GRID_WIDTHS: SrcSetEntry[] = [
  { w: 400, q: 82 },
  { w: 800, q: 84 },
  { w: 1200, q: 84 },
  { w: 1600, q: 86 },
];

const HERO_WIDTHS: SrcSetEntry[] = [
  { w: 640, q: 88 },
  { w: 1024, q: 88 },
  { w: 1536, q: 88 },
  { w: 2400, q: 88 },
];

const LIGHTBOX_WIDTHS: SrcSetEntry[] = [
  { w: 800, q: 82 },
  { w: 1200, q: 85 },
  { w: 1600, q: 85 },
  { w: 1920, q: 85 },
];

export type ImagePreset = "grid" | "hero" | "lightbox";

function widthsFor(preset: ImagePreset): SrcSetEntry[] {
  switch (preset) {
    case "hero":
      return HERO_WIDTHS;
    case "lightbox":
      return LIGHTBOX_WIDTHS;
    default:
      return GRID_WIDTHS;
  }
}

/** その用途で一番小さい候補。先読みの `href` に使う。 */
export function smallestFor(preset: ImagePreset): SrcSetEntry {
  return widthsFor(preset)[0];
}

/** グリッドの `sizes`。先読みの `imagesizes` と一致していないと空振りする。 */
export const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

export type PhotoImage = {
  url: string;
  rotationDeg?: RotationDeg | number | null;
};

export function srcSetFor(
  url: string,
  preset: ImagePreset,
  fmt?: ImageFormat,
  rotationDeg?: unknown,
): string {
  return widthsFor(preset)
    .map(
      ({ w, q }) =>
        `${imageUrlWithParams(url, { w, q, fmt, rotationDeg })} ${w}w`,
    )
    .join(", ");
}

export function srcFor(
  url: string,
  w: number,
  q: number,
  fmt?: ImageFormat,
  rotationDeg?: unknown,
): string {
  return imageUrlWithParams(url, { w, q, fmt, rotationDeg });
}

export function photoSrcSetFor(
  photo: PhotoImage,
  preset: ImagePreset,
  fmt?: ImageFormat,
): string {
  return srcSetFor(photo.url, preset, fmt, photo.rotationDeg);
}

export function photoSrcFor(
  photo: PhotoImage,
  w: number,
  q: number,
  fmt?: ImageFormat,
): string {
  return srcFor(photo.url, w, q, fmt, photo.rotationDeg);
}
