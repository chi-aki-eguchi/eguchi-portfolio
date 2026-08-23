/**
 * 行頭に「ー」を落とさない（禁則処理）。
 *
 * 2026-08-23 に管理画面の Settings を実測したところ、
 * 「ナビゲーション（位置・ホバ / ー）」と割れていた。長音符が独りで行頭へ
 * 落ちる状態で、日本語の組版としては誤り。既定の `line-break: auto` は
 * 長音符や小書きのかなの前で平気で改行する。
 *
 * jsdom は行分割をしないので、ここで縛れるのは宣言があることだけ。
 * **実際に割れているかは実ブラウザでしか測れない。** 測り方は
 * `docs/agents/measuring.md` の「禁則が効いているかを測る」に書いた。
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
// コメントの中で `line-break: auto` に言及しているのは説明であって宣言ではない。
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

test("公開側と管理画面の両方に line-break: strict がかかっている", () => {
  const block = css.match(
    /:root,\s*\.admin-atelier\s*\{[^}]*\}/,
  )?.[0];
  expect(block).toBeDefined();
  expect(block).toContain("line-break: strict");
});

test("禁則を緩める指定を後から足していない", () => {
  // `line-break: loose` / `normal` はこの規則を打ち消す。どうしても必要な
  // 箇所が出たら、ここを直すのではなく理由をコメントに書いてから外すこと。
  expect(css).not.toMatch(/line-break:\s*(loose|normal|auto)\b/);
});
