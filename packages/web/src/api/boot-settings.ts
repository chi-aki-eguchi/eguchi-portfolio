/**
 * サイトの設定（/api/settings と同じ中身）を HTML に入れる（2026-10-02）。
 *
 * 画面のプログラムは、全部を読み終えてから設定を取り寄せていた（スマホ・4G 相当で 1.85 秒に
 * 開始、2.18 秒に到着）。名前・色・書体・写真の並べ方はすべて設定から来るので、それまで
 * 中身を描けず、書体の読み込みもその後になっていた。HTML を返すときに同じ中身を入れておけば、
 * プログラムが動いた時点ですぐ描ける（`web/lib/boot-settings.ts` が読む）。
 *
 * `<` は `\u003c` に置き換える。設定の文（自己紹介など）に `</script>` があっても、ここで
 * 閉じさせない。JSON としては同じ値に戻る。
 */
export function bootSettingsScript(json: string): string {
  return `<script id="boot-settings" type="application/json">${json.replace(/</g, "\\u003c")}</script>`;
}
