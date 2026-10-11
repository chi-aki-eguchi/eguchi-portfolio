import { Fragment, useMemo, type ReactNode } from "react";
import { jaPhrases } from "../lib/ja-phrases";

export { jaPhrases } from "../lib/ja-phrases";

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
 * 短い文節は `.ja-phrase`（white-space: nowrap）で包む（2026-10-01）。Safari の
 * `text-wrap: pretty` は keep-all の中でも開き括弧の直後で折り、「非公開に
 * しました（／サイトに出ません）」と括弧だけを行末に残していた（WebKit で再現、
 * Chromium は正しい）。長い文節は包まない。細い画面で1行に入らないと横へはみ出すため。
 *
 * 日本語を含まない文（英語のページなど）は、そのまま返す。文節の区切りは
 * `lib/ja-phrases.ts`（PDF 作品集の組版と共用）。
 */
const NOWRAP_MAX = 12;

/**
 * 長い文節の中の、桁区切りのある数字（¥10,000・3.5・2026.10.12 など）は、折らない箱に入れる
 * （2026-10-12）。keep-all の中でも桁区切りのコンマの後では折り返せてしまい、本番のスマホ
 * （Safari）で「ポートレート撮影 60分 ¥10,／000。学生の方は半額です。」と金額が2行に割れていた
 * （文がちょうど1行に入らない幅のとき、text-wrap: pretty が2行の長さをそろえようとして選ぶ）。
 * 続く句読点・閉じ括弧も一緒に入れる（行の頭に「。」だけを落とさない）。
 */
const NUMBER = /([¥￥$€]?\d+(?:[,.]\d+)+[%％円]?[。、，．）)」』]*)/;

function keepNumbers(phrase: string): ReactNode {
  const parts = phrase.split(NUMBER);
  if (parts.length < 3) return phrase;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="ja-phrase">
        {part}
      </span>
    ) : (
      part
    ),
  );
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
          {phrase.length <= NOWRAP_MAX ? <span className="ja-phrase">{phrase}</span> : keepNumbers(phrase)}
        </Fragment>
      ))}
    </span>
  );
}
