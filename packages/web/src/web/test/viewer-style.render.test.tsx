/**
 * 写真ビューアの壁（viewerStyle）の回帰テスト。
 *
 * 2026-08-08 のオーナー決定は「ビューアは常に白い壁、UIは黒インク」だった。
 * その狙いは**暗色テーマでインクだけ白へ反転し、白い壁の上で読めなくなるのを
 * 防ぐこと**（Lightbox.tsx 冒頭）。2026-08-11 のオーナー承認で壁を選べるように
 * したが、狙いは変えない。
 *
 * だからここで縛るのは「壁とインクが必ず対で替わること」。
 *  1. 既定は従来どおり白い壁 + 黒インク
 *  2. 暗室では壁が暗く、インクは白（片方だけ替わらない）
 *  3. 公開サイトのテーマ変数を参照しない
 */
import { test, expect, describe } from "bun:test";
import { VIEWER_PALETTES, viewerPalette } from "../components/Lightbox";

// "r,g,b" の明るさ。壁は #hex なので別に解く。
function lumFromRgbTriple(triple: string): number {
  const [r, g, b] = triple.split(",").map((n) => Number(n.trim()) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function lumFromHex(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return lumFromRgbTriple(`${r},${g},${b}`);
}
function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("ビューアの壁", () => {
  test("既定は白い壁と黒インク（従来どおり）", () => {
    const p = viewerPalette(undefined);
    expect(p.wall).toBe("#fff");
    expect(p.ink).toBe("0,0,0");
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", () => {
    expect(viewerPalette("ドーン").wall).toBe("#fff");
    expect(viewerPalette("").wall).toBe("#fff");
  });

  test("どの壁でも、インクとの明暗差がAAを満たす", () => {
    for (const [name, p] of Object.entries(VIEWER_PALETTES)) {
      const ratio = contrast(lumFromHex(p.wall), lumFromRgbTriple(p.ink));
      expect(ratio, `${name}: 壁とインクの差 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("壁とインクは必ず対で替わる（片方だけ明暗が逆にならない）", () => {
    for (const [name, p] of Object.entries(VIEWER_PALETTES)) {
      const wallLum = lumFromHex(p.wall);
      const inkLum = lumFromRgbTriple(p.ink);
      const veilLum = lumFromRgbTriple(p.veil);
      // 暗い壁には明るいインク、明るい壁には暗いインク
      expect(wallLum > 0.5 ? inkLum < 0.5 : inkLum > 0.5, `${name}: インクの明暗が壁と同じ側`).toBe(true);
      // veil は「壁と同じ色の薄い幕」。壁と同じ側でなければ白い箱が浮く
      expect(wallLum > 0.5 ? veilLum > 0.5 : veilLum < 0.5, `${name}: veil が壁と逆側`).toBe(true);
    }
  });

  test("公開サイトのテーマ変数を参照しない", async () => {
    const src = await Bun.file(
      new URL("../components/Lightbox.tsx", import.meta.url).pathname,
    ).text();
    // --foreground / --background を掴むと、暗色テーマでインクだけ反転する
    expect(src).not.toContain("var(--foreground");
    expect(src).not.toContain("var(--background");
  });
});
