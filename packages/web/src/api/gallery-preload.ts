import { escapeHtml } from "./ogp";
import {
  GRID_SIZES,
  smallestFor,
  srcFor,
  srcSetFor,
} from "../shared/image-presets";

export type GalleryPreloadImage = {
  url: string;
  rotationDeg: number;
  /** 作り置きサムネのURL。あるなら一覧はこれをそのまま `<img src>` に使う。 */
  preloadUrl?: string;
};

/**
 * `/gallery` と `/`（ランダム以外）のHTMLへ入れる、写真の先読みタグ。
 *
 * **先読みは、一覧が実際に取りに行くURLと一字一句同じでないと空振りする。**
 * 以前はここが独自に「幅600・画質84・形式指定なし」のproxy URLを作っていた。
 * 一方 `PhotoGallery.tsx` の描き方は2通りある。
 *
 *   1. 作り置きサムネがある枚 → `<img src={thumbUrl}>`。`<source>` は出ない
 *   2. 無い枚 → `<source type="image/avif" srcset=...>` が先に当たる
 *
 * どちらとも一致していなかったので、**先読みした8枚は1枚も使われず**、
 * 本当に表示する画像には先読みが1枚も付いていなかった。初回訪問者は
 * 見えない画像8枚ぶんの通信をしていたことになる。
 *
 * 幅と画質の表は `shared/image-presets.ts` に置き、クライアントと共有している。
 * 数字を書き写すのをやめないと、次に幅を変えたときにまた黙ってずれる。
 */
export function buildGalleryPreloadTags(
  images: GalleryPreloadImage[],
): string {
  return images
    .map((img) => {
      if (img.preloadUrl) {
        return `<link rel="preload" as="image" href="${escapeHtml(img.preloadUrl)}">`;
      }
      const { w, q } = smallestFor("grid");
      const href = escapeHtml(srcFor(img.url, w, q, "avif", img.rotationDeg));
      const srcset = escapeHtml(
        srcSetFor(img.url, "grid", "avif", img.rotationDeg),
      );
      // `type` を添えると、AVIF を読めないブラウザはこの先読みを飛ばす
      // （読めない形式を取りに行かせない）。
      return `<link rel="preload" as="image" type="image/avif" href="${href}" imagesrcset="${srcset}" imagesizes="${escapeHtml(GRID_SIZES)}">`;
    })
    .join("\n  ");
}
