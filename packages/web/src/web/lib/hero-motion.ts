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
  // **既定を動かしたら、必ず3段とも一緒に引き直す。**引き直さないと「標準」が
  // 「ゆっくり」に追いつき、3段階が実質2段階に潰れる（2026-08-30 に実際に
  // 起きた: 標準 780ms / ゆっくり 850ms）。
  // 既定 600 → 780（8/30）→ 1100ms（8/31、オーナー「全体的にまだ速い」）。
  if (speed === "slow") vars["--top-motion-duration"] = "1500ms";
  if (speed === "quick") vars["--top-motion-duration"] = "720ms";

  if (order === "text-first") {
    // 既定（写真から）を 0.2/0.3/0.4 → 0.28/0.46/0.64 へ広げたのに合わせる。
    vars["--hero-photo-delay"] = "0.62s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0.25s";
    vars["--hero-text-delay-3"] = "0.5s";
  } else if (order === "together") {
    vars["--hero-photo-delay"] = "0s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0s";
    vars["--hero-text-delay-3"] = "0s";
  }

  return vars;
}
