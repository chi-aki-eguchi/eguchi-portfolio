/**
 * 設定が届く前の最初の描画に使う、文字の太さ（2026-10-02）。
 *
 * 公開サイトの本文は `font-weight: var(--body-weight, 400)`。値は画面のプログラムが
 * 設定（/api/settings）を読んでから入れるので、それまでは既定の 400 で描かれていた。
 * 本番は本文・名前とも 500 で、最初に 400 で描いた字のために しっぽり明朝 400 の文字の束を
 * 5本（80KB）余分に読み、届いた瞬間に太さが 400→500 へ切り替わっていた。HTML を返すときに
 * 設定の値を先に書いておく。画面のプログラムが値を当てたら、この指定は外す（provider.tsx）。
 */
const WEIGHT = /^[1-9]00$/;

export function bootThemeStyle(settings: Record<string, string | undefined>): string {
  const vars: string[] = [];
  if (WEIGHT.test(settings.bodyWeight ?? "")) vars.push(`--body-weight:${settings.bodyWeight}`);
  if (WEIGHT.test(settings.heroNameWeight ?? "")) vars.push(`--hero-name-weight:${settings.heroNameWeight}`);
  return vars.length ? `<style id="boot-theme">:root{${vars.join(";")}}</style>` : "";
}
