/**
 * 新しい構成（siteDesign = "develop"）の下見（2026-10-10）。
 *
 * 住所に `?design=develop` を付けて開くと、そのタブの間だけ新しい構成で描く。
 * 保存されている設定は変えないので、ほかの人が見る公開サイトは今までのまま。
 * タブを閉じるまで覚えておき（ページを移っても続く）、`?design=classic` でやめる。
 * 下見の間は検索に載せない印（noindex）を付ける。
 */
const KEY = "design-preview";

export type PreviewDesign = "develop";

export function resolvePreviewDesign(
  search: string,
  stored: string | null,
): { design: PreviewDesign | null; write: "develop" | "" | undefined } {
  const asked = new URLSearchParams(search).get("design");
  if (asked === "develop") return { design: "develop", write: "develop" };
  // `?design=classic` など、develop 以外を指定したら下見をやめる。
  if (asked !== null) return { design: null, write: "" };
  return { design: stored === "develop" ? "develop" : null, write: undefined };
}

let cached: PreviewDesign | null | undefined;

export function previewDesign(): PreviewDesign | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  let stored: string | null = null;
  try {
    stored = window.sessionStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  const { design, write } = resolvePreviewDesign(window.location.search, stored);
  try {
    if (write === "") window.sessionStorage.removeItem(KEY);
    else if (write) window.sessionStorage.setItem(KEY, write);
  } catch {
    // 保存できない環境（プライベート表示など）では、この1ページだけ下見になる。
  }
  if (design && !document.querySelector('meta[name="robots"][data-design-preview]')) {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    meta.setAttribute("data-design-preview", "");
    document.head.appendChild(meta);
  }
  cached = design;
  return design;
}

/** テスト用：覚えた下見の状態を捨てる。 */
export function resetPreviewDesignForTest(): void {
  cached = undefined;
}
