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

  if (speed === "slow") vars["--top-motion-duration"] = "850ms";
  if (speed === "quick") vars["--top-motion-duration"] = "400ms";

  if (order === "text-first") {
    vars["--hero-photo-delay"] = "0.3s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0.1s";
    vars["--hero-text-delay-3"] = "0.2s";
  } else if (order === "together") {
    vars["--hero-photo-delay"] = "0s";
    vars["--hero-text-delay-1"] = "0s";
    vars["--hero-text-delay-2"] = "0s";
    vars["--hero-text-delay-3"] = "0s";
  }

  return vars;
}
