// JS を実行しないクローラに、そのページの言葉とリンクを渡す。
//
// 公開サイトは SPA で、サーバが返す HTML の <body> は `<div id="root">` だけ
// だった（2026-09-01 実測で 481 バイト）。<head>（title / description /
// canonical / JSON-LD / sitemap）は揃っていたので、足りないのは本文のほう。
// Google は JS を実行するが、他の検索・SNS・AI のクローラの多くは実行しない。
// それらにはシリーズの statement もプロフィール文も一語も見えていない。
//
// **なぜ <noscript> か。** `#root` の中に本文を置くと、`createRoot().render()`
// が最初の描画で中身を丸ごと捨てるので、文字が一瞬出てから消える。オーナーが
// 何週間もかけて整えた「開いた瞬間」を壊す。かといって見えない場所へ検索用の
// 文字を隠すのは cloaking で、本物の商売のサイトでやることではない。
// <noscript> は「JS が動かないときに見えるもの」という宣言そのものなので、
// 隠していることにならず、画面にも一切影響しない。
//
// これは JS を実行するクローラ（Google）への効き目は薄い。効くのは
// 実行しない側で、いまそこには何も届いていない、というのがここの目的。
import { escapeHtml } from "./ogp";

export type FallbackLink = { href: string; label: string };

export type FallbackInput = {
  /** 見出し。ページの題そのもの（`|` で連ねた <title> ではなく人が読む形）。 */
  heading: string;
  /** 1段落目。<meta name="description"> と同じ文でよい。 */
  description: string;
  /** 続きの段落（シリーズの statement、プロフィール文など）。 */
  paragraphs?: readonly string[];
  /** そのページから辿れる先。ここが無いと非JSのクローラにはリンクが0本になる。 */
  links?: readonly FallbackLink[];
  /** JS が要ることを人に伝える一文。既存の文言をそのまま渡す。 */
  noticeJa: string;
  noticeEn: string;
};

// 段落は空文字を落としてから積む。settings が未設定のサイトで
// 空の <p> が並ぶのを避ける。
function paragraphMarkup(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

export function buildNoscriptFallback(input: FallbackInput): string {
  const { heading, description, paragraphs = [], links = [] } = input;
  const body = [description, ...paragraphs]
    .map((t) => t.trim())
    .filter(Boolean)
    .map(paragraphMarkup)
    .join("");
  const nav = links.length
    ? `<nav><ul>${links
        .map(
          (l) =>
            `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`,
        )
        .join("")}</ul></nav>`
    : "";
  const head = heading.trim() ? `<h1>${escapeHtml(heading.trim())}</h1>` : "";
  return `<noscript>${head}${body}${nav}<p>${escapeHtml(
    input.noticeJa,
  )}<br>${escapeHtml(input.noticeEn)}</p></noscript>`;
}

// index.html の <noscript> ブロックを丸ごと差し替える。見つからなければ
// HTML をそのまま返す（テンプレートを書き換えても本番が落ちないように）。
const NOSCRIPT_BLOCK = /<noscript>[\s\S]*?<\/noscript>/;

export function injectNoscriptFallback(
  html: string,
  input: FallbackInput,
): string {
  if (!NOSCRIPT_BLOCK.test(html)) return html;
  const markup = buildNoscriptFallback(input);
  return html.replace(NOSCRIPT_BLOCK, () => markup);
}
