import { Fragment, useMemo } from "react";
import { Parser, jaModel } from "budoux";

/**
 * 日本語の文を、文節の切れ目でだけ折り返す（2026-10-01）。
 *
 * `.ja-prose` の `word-break: auto-phrase` は Chrome にしか無い。オーナーの
 * Safari では黙って無視され、そこへ `text-wrap: pretty` だけが効いて、
 * 「デジタ／ル」「コラボレーショ／ン」「ご相／談ください。」と語の途中で
 * 割れていた（本番を WebKit で 320〜1440px 撮って確認）。
 *
 * BudouX（Google の文節区切り、Apache-2.0）で文節を出し、あいだに `<wbr>` を
 * 置く。包む `.ja-phrases` が `word-break: keep-all` なので、折り返せるのは
 * `<wbr>` と句読点と空白だけになる。どのブラウザでも同じ所で折れる。
 *
 * 日本語を含まない文（英語のページなど）は、そのまま返す。
 */
const JAPANESE = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;

let parser: Parser | null = null;
const cache = new Map<string, string[]>();

export function jaPhrases(text: string): string[] {
  if (!JAPANESE.test(text)) return [text];
  const hit = cache.get(text);
  if (hit) return hit;
  parser ??= new Parser(jaModel);
  const phrases = parser.parse(text);
  // 文はオーナーの設定と写真の説明だけなので多くないが、際限なく溜めない。
  if (cache.size > 500) cache.clear();
  cache.set(text, phrases);
  return phrases;
}

export function JaPhrases({ children }: { children: string | null | undefined }) {
  const text = children ?? "";
  const phrases = useMemo(() => jaPhrases(text), [text]);
  if (phrases.length < 2) return <>{text}</>;
  return (
    <span className="ja-phrases">
      {phrases.map((phrase, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {phrase}
        </Fragment>
      ))}
    </span>
  );
}
