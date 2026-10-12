/**
 * 現像の途中の像（2026-10-12、新しい構成の表紙の現れ方）。
 *
 * 写真を小さく描き、色を抜いて少し茶に寄せ、濃淡の差を弱めた像を作る。これを表紙の大きさへ
 * 引き伸ばすと、ぼけた単色の像になる。**ぼかしを CSS の filter で掛けない**のは、実測で重かったから
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
 * 像を描く大きさ。引き伸ばしたとき、元の1点がおよそ 12px になる細かさにする
 * （どの画面でも同じくらいのぼけ方になる）。縦横比は写真のまま。
 */
export function latentSize(
  naturalWidth: number,
  naturalHeight: number,
  shownWidth: number,
  shownHeight: number,
): { width: number; height: number } {
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1.5;
  const long = Math.min(128, Math.max(32, Math.round(Math.max(shownWidth, shownHeight) / 12)));
  return ratio >= 1
    ? { width: long, height: Math.max(8, Math.round(long / ratio)) }
    : { width: Math.max(8, Math.round(long * ratio)), height: long };
}

/** 上下左右の隣とならす（引き伸ばしたときの角ばりを消す）。その場で書き換える。 */
export function softenPixels(data: Uint8ClampedArray | number[], width: number, height: number): void {
  const src = Array.from(data);
  const at = (x: number, y: number, c: number) =>
    src[(Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4 + c]!;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const sum =
          at(x, y, c) * 4 + (at(x - 1, y, c) + at(x + 1, y, c) + at(x, y - 1, c) + at(x, y + 1, c)) * 2 +
          at(x - 1, y - 1, c) + at(x + 1, y - 1, c) + at(x - 1, y + 1, c) + at(x + 1, y + 1, c);
        data[(y * width + x) * 4 + c] = Math.round(sum / 16);
      }
    }
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
    softenPixels(pixels.data, width, height);
    ctx.putImageData(pixels, 0, 0);
    return true;
  } catch {
    // 描けない（古いブラウザ・読めない画像）ときは下地なしで、本物だけが今までどおり現れる。
    return false;
  }
}
