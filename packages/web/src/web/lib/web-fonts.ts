/**
 * サイトの書体（`--font-en` / `--font-ja` の先頭の書体）が届くまで待つ。
 *
 * `document.fonts.ready` だけでは足りない。書体の読み込み（Google Fonts の
 * スタイルシート）は設定が届いてから差し込まれるので、その前に ready を見ると
 * 「読み込むものが無い」と即座に返り、あとから書体が差し替わって文字の幅が
 * 変わる（実測 2026-09-26: 表示の 0.5 秒後に「Series」が 50px → 40px）。
 * スタイルシートの到着 → 書体そのもの、の順に待つ。どこかで止まっても
 * `timeoutMs` で必ず返す。
 */
export function waitForWebFonts(timeoutMs = 1500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const sheets = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]'),
  ).filter((link) => !link.sheet);
  const sheetsLoaded = Promise.all(
    sheets.map(
      (link) =>
        new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
  const root = getComputedStyle(document.documentElement);
  const families = ["--font-en", "--font-ja"]
    .map((v) => root.getPropertyValue(v).split(",")[0]?.trim().replace(/^["']|["']$/g, ""))
    .filter((f): f is string => Boolean(f));
  const work = sheetsLoaded
    .then(() =>
      Promise.all(families.map((f) => document.fonts.load(`16px "${f}"`, "Aa江口秋").catch(() => []))),
    )
    .then(() => undefined);
  return Promise.race([work, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
