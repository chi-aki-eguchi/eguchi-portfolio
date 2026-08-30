import { describe, expect, test } from "bun:test";
import { heroMotionCssVars } from "./hero-motion";

describe("hero motion CSS settings", () => {
  test("keeps standard + photo-first on the stylesheet defaults", () => {
    expect(heroMotionCssVars("standard", "photo-first")).toEqual({
      "--top-motion-duration": undefined,
      "--hero-photo-delay": undefined,
      "--hero-text-delay-1": undefined,
      "--hero-text-delay-2": undefined,
      "--hero-text-delay-3": undefined,
    });
  });

  // 2026-08-30、オーナー依頼「モーションもっと余裕を持たせて」でスタイルシート
  // 側の既定を 600ms → 780ms へ広げた。**「標準」は値を持たずその既定が出る**
  // ので、ゆっくり／すばやくも一緒に引き直さないと3段階が潰れる。
  test("3段階は、広げた既定（780ms）を挟んで離れている", () => {
    expect(heroMotionCssVars("slow", "photo-first")["--top-motion-duration"]).toBe(
      "1050ms",
    );
    expect(
      heroMotionCssVars("quick", "photo-first")["--top-motion-duration"],
    ).toBe("520ms");
  });

  test("文字からの順番も、広げた間隔に合わせる", () => {
    expect(heroMotionCssVars("standard", "text-first")).toEqual({
      "--top-motion-duration": undefined,
      "--hero-photo-delay": "0.44s",
      "--hero-text-delay-1": "0s",
      "--hero-text-delay-2": "0.18s",
      "--hero-text-delay-3": "0.36s",
    });
  });

  test("maps together to simultaneous photo and text", () => {
    expect(heroMotionCssVars("standard", "together")).toEqual({
      "--top-motion-duration": undefined,
      "--hero-photo-delay": "0s",
      "--hero-text-delay-1": "0s",
      "--hero-text-delay-2": "0s",
      "--hero-text-delay-3": "0s",
    });
  });

  test("treats empty or unknown values as the safe defaults", () => {
    expect(heroMotionCssVars("", "")).toEqual(
      heroMotionCssVars("standard", "photo-first"),
    );
    expect(heroMotionCssVars("unexpected", "unexpected")).toEqual(
      heroMotionCssVars("standard", "photo-first"),
    );
  });
});
