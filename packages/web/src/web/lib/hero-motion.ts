export type HeroMotionCssVars = {
  "--top-motion-duration": string | undefined;
  "--hero-photo-delay": string | undefined;
  "--hero-text-delay-1": string | undefined;
  "--hero-text-delay-2": string | undefined;
  "--hero-text-delay-3": string | undefined;
};

const DEFAULT_VARS: HeroMotionCssVars = {
  "--top-motion-duration": undefined,
  "--hero-photo-delay": undefined,
  "--hero-text-delay-1": undefined,
  "--hero-text-delay-2": undefined,
  "--hero-text-delay-3": undefined,
};

export function heroMotionCssVars(
  speed: string | undefined,
  order: string | undefined,
): HeroMotionCssVars {
  const vars = { ...DEFAULT_VARS };

  // 「標準」は値を入れない＝スタイルシートの既定（`--top-motion-duration`）。
  // 2026-08-30 にその既定を 600ms → 780ms へ広げたので、ここも一緒に引き直す。
  // **引き直さないと「標準 780ms」と「ゆっくり 850ms」がほぼ同じになり、
  // 3段階が2段階に潰れる。**
  if (speed === "slow") vars["--top-motion-duration"] = "1050ms";
  if (speed === "quick") vars["--top-motion-duration"] = "520ms";

  if (order === "text-first") {
    // 既定（写真から）を 0.2/0.3/0.4 → 0.28/0.46/0.64 へ広げたのに合わせる。
    vars["--hero-photo-delay"] = "0.44s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0.18s";
    vars["--hero-text-delay-3"] = "0.36s";
  } else if (order === "together") {
    vars["--hero-photo-delay"] = "0s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0s";
    vars["--hero-text-delay-3"] = "0s";
  }

  return vars;
}
