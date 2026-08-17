/**
 * 「公開サイトの基準URL」(`siteUrl`) の検証と整形。
 *
 * この1つの値から、canonical・OGP の `og:url` と画像URL・サイトマップの全URL・
 * 日英の言語alternate・robots の Sitemap 行が組み立てられる。**壊れていても
 * 画面は普通に見えるので、気づくのは検索結果やSNSの見え方が崩れてから**になる。
 *
 * それなのに、この欄はただの文字入力で、保存時の検査が無かった。検査があるのは
 * 連絡先の2項目だけ（`contact-settings.ts`）。`akieguchi.com`（scheme無し）や
 * `https://akieguchi.com/`（末尾スラッシュ）や前後の空白が、そのまま保存できた。
 *
 * 空欄は許す。**未設定は「まだ決めていない」であって、誤りではない**
 * （配布直後がこれ。サーバー側にはリクエストのホストから組み立てる道がある）。
 */
export function normalizeSiteUrlSetting(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  // 末尾のスラッシュは落とす。付いたまま保存されると、組み立てた先で
  // `https://example.com//gallery` のような二重スラッシュになる。
  return raw.replace(/\/+$/, "");
}

export function isValidSiteUrlSetting(value: unknown): boolean {
  const url = normalizeSiteUrlSetting(value);
  if (!url) return true; // 空欄＝未設定は許す
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname.length > 0 &&
      // ホスト名に点が無いものは、まず打ち間違い（`localhost` は開発用で、
      // 公開サイトの基準URLとして保存する意味が無い）。
      parsed.hostname.includes(".") &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.hash.length === 0 &&
      parsed.search.length === 0
    );
  } catch {
    return false;
  }
}
