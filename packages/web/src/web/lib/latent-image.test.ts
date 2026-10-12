import { describe, expect, test } from "bun:test";
import { latentSize, softenPixels, toLatentTone } from "./latent-image";

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

  test("描く大きさ：縦横比は写真のまま、どの画面でも元の1点がおよそ 12px", () => {
    // スマホの全画面（390×608）に 4:5 の写真
    expect(latentSize(1600, 2000, 390, 608)).toEqual({ width: 41, height: 51 });
    // PC（1336×982）に 5:4 の写真
    expect(latentSize(2000, 1600, 1336, 982)).toEqual({ width: 111, height: 89 });
    // とても大きい画面でも 128 まで、まだ測れていない（0）ときも 32 は取る
    expect(latentSize(3000, 2000, 4000, 2000).width).toBe(128);
    expect(latentSize(3000, 2000, 0, 0)).toEqual({ width: 32, height: 21 });
    // 寸法の分からない写真は 3:2 とみなす
    expect(latentSize(0, 0, 600, 400)).toEqual({ width: 50, height: 33 });
  });

  test("ならす：1点だけ明るい像が、まわりへにじむ（合計の明るさはほぼ同じ）", () => {
    const w = 5, h = 5;
    const px: number[] = Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : 0));
    const mid = (2 * w + 2) * 4;
    px[mid] = px[mid + 1] = px[mid + 2] = 160;
    softenPixels(px, w, h);
    expect(px[mid]!).toBe(40);
    expect(px[mid - 4]!).toBe(20);
    expect(px[mid - (w + 1) * 4]!).toBe(10);
    let total = 0;
    for (let i = 0; i < px.length; i += 4) total += px[i]!;
    expect(total).toBe(160);
    expect(px[3]).toBe(255);
  });
});
