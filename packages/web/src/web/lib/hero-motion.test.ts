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

  test("maps all speed choices without changing easing", () => {
    expect(heroMotionCssVars("slow", "photo-first")["--top-motion-duration"]).toBe(
      "850ms",
    );
    expect(
      heroMotionCssVars("quick", "photo-first")["--top-motion-duration"],
    ).toBe("400ms");
  });

  test("maps text-first to a 0.1 second rhythm", () => {
    expect(heroMotionCssVars("standard", "text-first")).toEqual({
      "--top-motion-duration": undefined,
      "--hero-photo-delay": "0.3s",
      "--hero-text-delay-1": "0s",
      "--hero-text-delay-2": "0.1s",
      "--hero-text-delay-3": "0.2s",
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
