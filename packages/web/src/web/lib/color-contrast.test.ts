import { describe, expect, test } from "bun:test";
import { contrastRatio, ensureAccentContrast } from "./color-contrast";

const rgb = (hex: string) => {
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

describe("ensureAccentContrast", () => {
  test("十分なコントラストの色はそのまま返す", () => {
    expect(ensureAccentContrast("#a33b2e", "#f7f7f7")).toBe("#a33b2e");
  });

  test("ライト背景で薄すぎる色は AA(4.5:1)までインク寄りに補正される", () => {
    const out = ensureAccentContrast("#ffd700", "#f7f7f7"); // 黄色 on 白
    expect(out).not.toBe("#ffd700");
    expect(contrastRatio(rgb(out), rgb("#f7f7f7"))).toBeGreaterThanOrEqual(4.5);
  });

  test("ダーク背景で暗すぎる色は紙寄りに補正される", () => {
    const out = ensureAccentContrast("#333333", "#121212");
    expect(out).not.toBe("#333333");
    expect(contrastRatio(rgb(out), rgb("#121212"))).toBeGreaterThanOrEqual(4.5);
  });

  test("getComputedStyle の rgb() 形式の背景を受け付ける", () => {
    const out = ensureAccentContrast("#ffd700", "rgb(247, 247, 247)");
    expect(contrastRatio(rgb(out), rgb("#f7f7f7"))).toBeGreaterThanOrEqual(4.5);
  });

  test("パース不能な入力は素通しして壊さない", () => {
    expect(ensureAccentContrast("tomato", "#f7f7f7")).toBe("tomato");
    expect(ensureAccentContrast("#a33b2e", "transparent")).toBe("#a33b2e");
  });
});
