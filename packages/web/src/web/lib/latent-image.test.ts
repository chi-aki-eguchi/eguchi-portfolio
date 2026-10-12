import { describe, expect, test } from "bun:test";
import { blurPixels, latentSize, toLatentTone } from "./latent-image";

describe("現像の途中の像", () => {
  test("色を抜いて少し茶に寄せ、濃淡の差を弱める（透明度は変えない）", () => {
    // 赤・緑・青・白・黒
    const px = [255, 0, 0, 255, 0, 255, 0, 200, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255];
    toLatentTone(px);
    for (let i = 0; i < px.length; i += 4) {
      // 茶に寄る：赤 ≥ 緑 ≥ 青。色の差は元よりずっと小さい。
      expect(px[i]!).toBeGreaterThanOrEqual(px[i + 1]!);
      expect(px[i + 1]!).toBeGreaterThanOrEqual(px[i + 2]!);
      expect(px[i]! - px[i + 2]!).toBeLessThan(48);
    }
    expect([px[3], px[7], px[11], px[15], px[19]]).toEqual([255, 200, 255, 255, 255]);
    // 白は少し沈み、黒は少し浮く（濃淡の差が弱まる）。
    expect(px[13]!).toBeLessThan(255);
    expect(px[17]!).toBeGreaterThan(0);
    // 明るい色ほど明るいまま（緑 > 赤 > 青 の順は保つ）。
    expect(px[5]!).toBeGreaterThan(px[1]!);
    expect(px[1]!).toBeGreaterThan(px[9]!);
  });

  test("描く大きさ：縦横比は写真のまま、表紙の 1/5 の細かさ", () => {
    // スマホの全画面（390×608）に 4:5 の写真
    expect(latentSize(1600, 2000, 390, 608)).toEqual({ width: 98, height: 122 });
    // PC（1336×982）に 5:4 の写真（長い辺は 200 まで）
    expect(latentSize(2000, 1600, 1336, 982)).toEqual({ width: 200, height: 160 });
    // まだ測れていない（0）ときも 64 は取る
    expect(latentSize(3000, 2000, 0, 0)).toEqual({ width: 64, height: 43 });
    // 寸法の分からない写真は 3:2 とみなす
    expect(latentSize(0, 0, 600, 400)).toEqual({ width: 120, height: 80 });
  });

  test("ぼかす：1点だけ明るい像が、なだらかな山になる（マス目にならない）", () => {
    const w = 21, h = 21;
    const px: number[] = Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0));
    const at = (x: number, y: number) => px[(y * w + x) * 4]!;
    px[(10 * w + 10) * 4] = 255;
    px[(10 * w + 10) * 4 + 1] = 255;
    px[(10 * w + 10) * 4 + 2] = 255;
    blurPixels(px, w, h, 2);
    // 真ん中がいちばん明るく、離れるほど暗い（途中で段がつかない）。
    const row = Array.from({ length: 11 }, (_, i) => at(10 + i, 10));
    for (let i = 1; i < row.length; i++) expect(row[i]!).toBeLessThanOrEqual(row[i - 1]!);
    expect(row[0]!).toBeGreaterThan(row[3]!);
    // 上下左右・斜めに偏らない。
    expect(at(8, 10)).toBe(at(12, 10));
    expect(at(10, 8)).toBe(at(10, 12));
    expect(at(8, 8)).toBe(at(12, 12));
    // 透明度は変えない。
    expect(px[3]).toBe(255);
  });

  test("ぼかす：一様な像は変わらない（縁が暗く沈まない）", () => {
    const w = 9, h = 7;
    const px: number[] = Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : 120));
    blurPixels(px, w, h, 2);
    for (let i = 0; i < px.length; i += 4) expect(px[i]).toBe(120);
  });

  test("ぼかす：PC の大きさ（200×160 点）でも、開いた直後を止めない速さ", () => {
    const w = 200, h = 160;
    // 手元の実測は 2〜4ms（2026-10-13）。混んだ機械でも落ちないよう、桁が変わったときだけ止める。
    const times = Array.from({ length: 5 }, () => {
      const px = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256);
      const started = performance.now();
      blurPixels(px, w, h, 2);
      return performance.now() - started;
    });
    expect(Math.min(...times)).toBeLessThan(40);
  });
});
