/**
 * 問い合わせフォームの送信が失敗したときに出す、メールへの逃げ道を組み立てる。
 *
 * フォームがある間、メールアドレスは Contact ページのどこにも出ない（表示するのは
 * 「フォーム未設定のとき」の枝だけ）。一時的な回線切れなら再送で通るが、送信先
 * サービスの停止や上限超過のように**繰り返しても直らない失敗**に当たった人は、
 * 連絡する手段が無いまま去ることになる。
 *
 * 書いた本文を持っていけることが要点である。もう一度打ち直させない。
 */
export function buildFailoverMailto(
  contactEmail: string,
  fields: {
    get(name: string): FormDataEntryValue | null;
  },
): string {
  // メールを設定していないサイト（購入者に多い）では、出せるものが無い。
  if (!contactEmail) return "";

  const text = (name: string) => String(fields.get(name) ?? "").trim();
  const subject = text("subject");
  const name = text("name");
  const message = text("message");

  const body = [message, name ? `— ${name}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const params: string[] = [];
  // `URLSearchParams` は空白を `+` にする。mailto の本文では `+` が空白へ
  // 戻らないメールクライアントがあるため、パーセント符号化で揃える。
  const enc = (v: string) => encodeURIComponent(v).replace(/%0A/g, "%0D%0A");
  if (subject) params.push(`subject=${enc(subject)}`);
  if (body) params.push(`body=${enc(body)}`);

  return `mailto:${contactEmail}${params.length ? `?${params.join("&")}` : ""}`;
}
