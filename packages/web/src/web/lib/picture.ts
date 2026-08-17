// 画像URLの組み立ては `shared/` にある。**`server.ts` が同じものを使うため。**
// 以前はここが正本で、HTMLへ先読みタグを入れる `server.ts` は同じ幅と画質を
// 手で書き写していた（`server.ts` は `web/` を import しない境界にあるため）。
// 写した幅は合っていたが形式(avif)と作り置きサムネを写せておらず、先読みした
// 8枚は1枚も使われていなかった。このファイルは呼び出し側を壊さないための窓口。
export {
  imageUrlWithParams,
  normalizeRotationDeg,
  objectPositionFromFocal,
  orientedAspectRatio,
  orientedDimensions,
  rotateFocalPoint,
  rotateRotationDeg,
  withRetryParam,
  withRetrySrcSet,
} from "../../shared/image-url";

export {
  GRID_SIZES,
  photoSrcFor,
  photoSrcSetFor,
  smallestFor,
  srcFor,
  srcSetFor,
  type ImagePreset,
} from "../../shared/image-presets";
