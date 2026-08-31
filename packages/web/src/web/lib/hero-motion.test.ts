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

  // **「標準」は値を持たずスタイルシートの既定が出る**ので、既定を動かしたら
  // ゆっくり／すばやくも一緒に引き直さないと3段階が潰れる。
  // 既定 600 →(8/30) 780 →(8/31) 1100ms。
  test("3段階は、広げた既定（1100ms）を挟んで離れている", () => {
    expect(heroMotionCssVars("slow", "photo-first")["--top-motion-duration"]).toBe(
      "1500ms",
    );
    expect(
      heroMotionCssVars("quick", "photo-first")["--top-motion-duration"],
    ).toBe("720ms");
  });

  test("文字からの順番も、広げた間隔に合わせる", () => {
    expect(heroMotionCssVars("standard", "text-first")).toEqual({
      "--top-motion-duration": undefined,
      "--hero-photo-delay": "0.62s",
      "--hero-text-delay-1": "0s",
      "--hero-text-delay-2": "0.25s",
      "--hero-text-delay-3": "0.5s",
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
