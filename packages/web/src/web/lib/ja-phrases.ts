import { Parser, jaModel } from "budoux";

/**
 * 日本語の文を文節に分ける（BudouX、Google の文節区切り、Apache-2.0）。
 *
 * 画面（components/JaPhrases.tsx）と PDF 作品集の組版（lib/portfolio-pdf/layout.ts）で
 * 同じ区切りを使う。React に依存しないので、PDF を作る Worker からも読める。
 * 日本語を含まない文は分けずにそのまま返す。
 */
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]/;

let parser: Parser | null = null;
const cache = new Map<string, string[]>();

export function hasJapanese(text: string): boolean {
  return JAPANESE.test(text);
}

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
