import { imageUrlWithParams } from "./image-url";

/**
 * About の写真の頼み方。画面（`web/pages/profile.tsx`）と、HTML の先頭に入れる
 * 先読み（`api/ogp.ts`）が**同じ URL・同じ幅の候補・同じ sizes** を使わないと、
 * 先読みした写真は使われず、同じ写真を2回取り寄せることになる。だから1か所に置く。
 */
export type ProfilePhotoLayout = "side" | "stack" | "quiet";

const WIDTHS = [600, 900, 1200] as const;
const QUALITY = 90;

/** 設定の値から並べ方を決める。知らない値・未設定は「写真左・文右」。 */
export function profilePhotoLayout(value: string | undefined | null): ProfilePhotoLayout {
  return value === "stack" || value === "quiet" || value === "side" ? value : "side";
}

export function profilePhotoSrc(url: string): string {
  return imageUrlWithParams(url, { w: 900, q: QUALITY });
}

export function profilePhotoSrcSet(url: string): string {
  return WIDTHS.map((w) => `${imageUrlWithParams(url, { w, q: QUALITY })} ${w}w`).join(", ");
}

export function profilePhotoSizes(layout: ProfilePhotoLayout): string {
  return layout === "stack"
    ? "(min-width: 768px) 768px, 90vw"
    : "(min-width: 768px) 300px, 90vw";
}
