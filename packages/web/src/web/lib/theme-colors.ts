// 公開サイトの背景色・文字色をテーマごとに決めて DOM へ当てる。
// provider.tsx（DB適用とライブプレビューの両方）から使う。React に依存しないので
// 単体テストから直接呼べる。

// DD: the grain blends with `multiply`, which is near-invisible over a dark
// background (dark × noise ≈ dark) — the texture would silently vanish on dark
// themes. Flip to `screen` (which lightens) when the chosen bg is dark.
// undefined = no/invalid themeBg → CSS default (multiply, matches light default bg).
export function textureBlendFor(bgHex: string | undefined): string | undefined {
  const hex = (bgHex || "").replace("#", "");
  if (hex.length < 6) return undefined;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return undefined;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? "screen" : "multiply";
}

function rgbTripleOf(hex: string): string | undefined {
  const h = hex.replace("#", "");
  if (h.length < 6) return undefined;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return undefined;
  return `${r},${g},${b}`;
}

export type ThemeColorSettings = {
  themeBg?: string;
  themeText?: string;
  themeBgDark?: string;
  themeTextDark?: string;
};

// styles.css の [data-theme="dark"] 既定と一致させる。未設定時に mobile の
// ブラウザ枠(theme-color)だけ実際の背景とずれるのを防ぐ。
export const THEME_DEFAULT_BG = { light: "#f7f7f7", dark: "#121212" } as const;

/**
 * B-21: オーナーが選んだ色は :root のインラインstyleとして当たるので、
 * styles.css の `[data-theme="dark"]` より強い。テーマごとに「当てる色」を
 * 選び直さないと、明るい背景に暗いテーマの文字色が乗って読めなくなる
 * （実測 #f5f0eb / #e8e8e8 で約1.08:1）。`useDarkMode` の既定は "system" なので、
 * 閲覧者が何も操作しなくてもこの状態になる。
 *
 * 暗いテーマ用の色が未設定なら空文字を返す。呼び出し側はインラインstyleを外し、
 * styles.css の既定へ戻す。**明るいテーマ用の色を暗いテーマへ流用しない。**
 */
export function themeColorsFor(
  resolved: "light" | "dark",
  s: ThemeColorSettings,
): { bg: string; text: string } {
  return resolved === "dark"
    ? { bg: s.themeBgDark ?? "", text: s.themeTextDark ?? "" }
    : { bg: s.themeBg ?? "", text: s.themeText ?? "" };
}

/** DB適用とライブプレビューの両方が通る唯一の適用口。空文字 = 既定へ戻す。 */
export function applyThemeColors(
  bg: string,
  text: string,
  resolved: "light" | "dark",
) {
  const root = document.documentElement;
  if (bg) {
    root.style.setProperty("--background", bg);
    document.body.style.backgroundColor = bg;
    const rgb = rgbTripleOf(bg);
    if (rgb) root.style.setProperty("--background-rgb", rgb);
  } else {
    root.style.removeProperty("--background");
    root.style.removeProperty("--background-rgb");
    document.body.style.removeProperty("background-color");
  }
  if (text) {
    root.style.setProperty("--foreground", text);
    document.body.style.color = text;
    const rgb = rgbTripleOf(text);
    if (rgb) root.style.setProperty("--foreground-rgb", rgb);
  } else {
    root.style.removeProperty("--foreground");
    root.style.removeProperty("--foreground-rgb");
    document.body.style.removeProperty("color");
  }
  const blend = textureBlendFor(bg);
  if (blend) root.style.setProperty("--bg-texture-blend", blend);
  else root.style.removeProperty("--bg-texture-blend");
  // Keep the mobile browser chrome (theme-color) in sync with the effective
  // background so a dark theme doesn't show a light status bar.
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta)
    themeMeta.setAttribute("content", bg || THEME_DEFAULT_BG[resolved]);
}
