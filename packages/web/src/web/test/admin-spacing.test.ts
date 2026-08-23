/**
 * admin の足元の余白は、保存バーの逃げであって飾りではない。
 *
 * 保存バーは `position: sticky; bottom: 18px` で、出ている間は最後の行に
 * かぶる。だが実測（2026-08-24 / 1440px・全タブ）では、未保存の変更が無い
 * とき**バーは DOM に存在しない**。それでも 96px 空けていたので、普段は
 * ページの末尾に 96px の死んだ帯がぶら下がっていた。
 *
 * **逃げが要るのは、逃げる相手が居るときだけ。** 実ブラウザで確認済み:
 * 未保存なし → 40px / 未保存あり → 96px。
 *
 * jsdom は CSS を解決しないので、ここで縛れるのは宣言の形だけ。
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

test("足元の余白は既定で小さく、変数で差し替えられる", () => {
  const rule = css.match(/\.admin-atelier \.ax-page \{[^}]*\}/)?.[0];
  expect(rule).toBeDefined();
  expect(rule).toContain("var(--ax-page-foot, 40px)");
  // 96px を直に書き戻すと、保存バーが無いときも空いたままに戻る。
  expect(rule).not.toContain("96px");
});

test("保存バーが出ているときだけ逃げを広げる", () => {
  const rule = css.match(
    /\.admin-atelier:has\(\.admin-floating-save-bar\) \.ax-page \{[^}]*\}/,
  )?.[0];
  expect(rule).toBeDefined();
  expect(rule).toContain("--ax-page-foot: 96px");
});

test("縦のリズムは等間隔にしない（節の切れ目のほうが広い）", () => {
  const page = css.match(/--ax-gap-page:\s*(\d+)px/)?.[1];
  const block = css.match(/--ax-gap-block:\s*(\d+)px/)?.[1];
  expect(page).toBeDefined();
  expect(block).toBeDefined();
  expect(Number(page)).toBeGreaterThan(Number(block));
});
