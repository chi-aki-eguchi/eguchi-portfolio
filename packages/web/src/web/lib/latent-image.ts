/**
 * 現像の途中の像（2026-10-12、新しい構成の表紙の現れ方）。
 *
 * 写真を小さく描き、色を抜いて少し茶に寄せ、濃淡の差を弱め、ぼかした像を作る。これを表紙の
 * 大きさへ引き伸ばすと、ぼけた単色の像になる。**ぼかしを CSS の filter で掛けない**のは、実測で重かったから
 * （2026-10-12、開いてから3秒のコマの間隔。Safari 系は filter を自分の層に載せないと約0.1秒の
 * 引っかかりが4回、Chrome 系は自分の層に載せると 32ms 超のコマが 19〜31。同じ指定で両方を
 * 軽くできない）。最初に1回だけ絵として作っておけば、あとは濃さを変えるだけで済む。
 */

/** 色を抜いて、少し茶に寄せ、濃淡の差を弱める。data は RGBA の並び（その場で書き換える）。 */
export function toLatentTone(data: Uint8ClampedArray | number[]): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const c = (y - 128) * 0.82 + 128;
    data[i] = Math.round(Math.min(255, c * 1.05));
    data[i + 1] = Math.round(c * 0.99);
    data[i + 2] = Math.round(c * 0.88);
  }
}

/**
 * 像を描く大きさ。表紙の 1/5 の細かさ（縦横比は写真のまま）。
 *
 * 最初は 1/12（スマホで 41×51）まで小さくして、引き伸ばしだけでぼかしていた。本番で撮ると、
 * 引き伸ばしの継ぎ目が 10px ほどの四角いマス目になって見えた（2026-10-13）。ぼけではなく
 * 粗い絵に見える。少し細かく描いて、絵の中でちゃんとぼかしてから（blurPixels）引き伸ばす。
 */
export function latentSize(
  naturalWidth: number,
  naturalHeight: number,
  shownWidth: number,
  shownHeight: number,
): { width: number; height: number } {
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1.5;
  const long = Math.min(LATENT_MAX, Math.max(64, Math.round(Math.max(shownWidth, shownHeight) / LATENT_SCALE)));
  return ratio >= 1
    ? { width: long, height: Math.max(8, Math.round(long / ratio)) }
    : { width: Math.max(8, Math.round(long * ratio)), height: long };
}

/** 表紙の何分の1の細かさで描くか。 */
const LATENT_SCALE = 5;
/** 長い辺の上限（点）。これより細かくしても、ぼかした像の見え方は変わらない。 */
const LATENT_MAX = 200;
/** 絵の中でのぼかしの半径（点）。3回かけると、表紙の上でおよそ 12px のなだらかなぼけになる。 */
const LATENT_BLUR_RADIUS = 2;

/**
 * 箱ぼかし（横 → 縦）を passes 回。3回でなだらかな山形（ガウスぼかし）に近づく。
 * 端は、端の点を外へ伸ばして扱う（縁が暗く沈まない）。透明度は変えない。その場で書き換える。
 */
export function blurPixels(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
  radius: number,
  passes = 3,
): void {
  if (!(radius > 0) || width < 1 || height < 1) return;
  const size = radius * 2 + 1;
  const line = new Float32Array(Math.max(width, height));
  // 1列ぶん（start から step おきに count 点）を、窓をずらしながら平均する。
  // 関数を挟まず添字だけで回す（PC の 256×205 点で、開いた直後の1コマを長くしないため）。
  const run = (start: number, step: number, count: number) => {
    const last = start + (count - 1) * step;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const at = start + k * step;
      sum += data[at < start ? start : at > last ? last : at]!;
    }
    for (let i = 0; i < count; i++) {
      line[i] = sum / size;
      const into = start + (i + radius + 1) * step;
      const out = start + (i - radius) * step;
      sum += data[into > last ? last : into]! - data[out < start ? start : out]!;
    }
    for (let i = 0; i < count; i++) data[start + i * step] = Math.round(line[i]!);
  };
  const stride = width * 4;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) for (let c = 0; c < 3; c++) run(y * stride + c, 4, width);
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) run(x * 4 + c, stride, height);
  }
}

/** 読み込んだ写真から、現像の途中の像を canvas に描く。描けたら true。 */
export function paintLatent(canvas: HTMLCanvasElement, image: HTMLImageElement): boolean {
  try {
    const box = canvas.getBoundingClientRect();
    const { width, height } = latentSize(image.naturalWidth, image.naturalHeight, box.width, box.height);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    toLatentTone(pixels.data);
    blurPixels(pixels.data, width, height, LATENT_BLUR_RADIUS);
    ctx.putImageData(pixels, 0, 0);
    return true;
  } catch {
    // 描けない（古いブラウザ・読めない画像）ときは下地なしで、本物だけが今までどおり現れる。
    return false;
  }
}
