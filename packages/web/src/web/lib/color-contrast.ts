// 公開側のアクセント色に WCAG AA(4.5:1)を機械的に保証する。
// admin.tsx の adminThemeFromSettings と同じ調整アルゴリズム(コントラストが
// 足りない色を、背景の明度に応じてインク寄り/紙寄りへ 1/24 刻みで寄せる)。
// admin 側は管理画面テーマ全体を導出する独立実装なので、ここでは公開側が
// 必要とする「1色 vs 実効背景」の形だけを持つ。

type Rgb = { r: number; g: number; b: number };

const clampChannel = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function parseColor(value?: string): Rgb | null {
  const raw = value?.trim();
  if (!raw) return null;
  // getComputedStyle が返す "rgb(r, g, b)" / "rgba(r, g, b, a)" 形式
  const m = raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((v) => clampChannel(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const n = clampChannel(v) / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/**
 * `color` が `backgroundCss` 上で AA(既定 4.5:1)を満たすよう必要最小限だけ
 * 補正した hex を返す。満たしていれば元の色をそのまま返す。
 * どちらかがパースできない場合は元の文字列を返す(壊すより素通し)。
 */
export function ensureAccentContrast(
  color: string,
  backgroundCss: string,
  min = 4.5,
): string {
  const fg = parseColor(color);
  const bg = parseColor(backgroundCss);
  if (!fg || !bg) return color;
  if (contrastRatio(fg, bg) >= min) return color;
  const target =
    relativeLuminance(bg) > 0.5
      ? { r: 18, g: 17, b: 15 }
      : { r: 250, g: 248, b: 242 };
  let adjusted = fg;
  for (let i = 1; i <= 24; i += 1) {
    adjusted = mix(fg, target, i / 24);
    if (contrastRatio(adjusted, bg) >= min) return toHex(adjusted);
  }
  return toHex(target);
}
