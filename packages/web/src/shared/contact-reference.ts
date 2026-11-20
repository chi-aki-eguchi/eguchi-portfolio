/**
 * 「この作品について相談する」——作品ページから Contact へ渡す参考作品。
 *
 * URL に載せるのは**公開されている作品群の識別子（slug）だけ**。氏名・メール・
 * 本文はここには載せない（アクセス解析にもクエリは渡らない。
 * `shared/analytics-path.ts` がクエリを落とす）。
 *
 * 受け取った側は slug を引き直し、公開されている作品のときだけ「参考作品」として
 * 見せる。読めない・非公開・存在しない識別子は、ただの Contact として扱う。
 */

import { DEVELOP_INQUIRY_ANCHOR } from "./develop-structure";

/** 作品ページに置く相談リンクの行き先。 */
export function contactHrefForWork(slug: string, page: "contact" | "info" = "contact"): string {
  const query = `work=${encodeURIComponent(slug)}`;
  return page === "info" ? `/info?${query}#${DEVELOP_INQUIRY_ANCHOR}` : `/contact?${query}`;
}

/**
 * クエリから参考作品の識別子を取り出す。
 *
 * ここでは「URL の1区画として成り立つか」だけを見る。実在・公開の判定は
 * 引き直した結果で行う——ここで当てにいくと、判定が2か所に散る。
 */
export function workSlugFromSearch(search: string): string {
  let raw = "";
  try {
    raw = new URLSearchParams(search).get("work") ?? "";
  } catch {
    return "";
  }
  const slug = raw.trim();
  if (!slug || slug.length > 200) return "";
  // 区切り・空白・制御文字を含むものは、作品の識別子ではない。
  // 制御文字は正規表現の範囲で書かない（そのまま埋め込むと JavaScriptCore
  // が読めず、エスケープすると lint の no-control-regex に掛かる）。
  const hasControl = [...slug].some((ch) => ch.charCodeAt(0) < 0x20);
  return hasControl || /[/?#\s]/.test(slug) ? "" : slug;
}

/** 送信内容に入れる一行。題名だけでは、どの作品か特定できないので公開URLも添える。 */
export function contactReferenceValue(
  title: string,
  publicUrl: string,
): string {
  return [title.trim(), publicUrl.trim()].filter(Boolean).join(" — ");
}

/** 参考作品の公開URL。基準URLが未設定なら、いま見ているサイトの origin を使う。 */
export function workPublicUrl(
  siteUrl: string | undefined,
  origin: string,
  slug: string,
): string {
  const base = (siteUrl ?? "").trim().replace(/\/+$/, "") || origin;
  return `${base}/work/${encodeURIComponent(slug)}`;
}
