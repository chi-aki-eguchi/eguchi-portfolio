/**
 * 管理画面の紙とインクは、公開サイトの色から独立していること。
 *
 * /admin は `Provider` の中にあるので、オーナーが選んだ `--background` /
 * `--foreground` は `:root` のインラインstyleとして `.admin-atelier` にも届く。
 * かつて `--admin-paper: var(--background, #f7f7f7)` と書かれており、公開サイトを
 * 黒や強い色にすると管理画面まで同じ色になっていた。
 *
 * 実測（2026-08-07 / localhost:5173 / 同じ宣言を再現して getComputedStyle）:
 *   `--background: #101010` のとき、旧宣言では `--admin-paper` が #101010 になり、
 *   新宣言では #f7f7f7 のままだった。
 *
 * 2026-08-07 に色数の上限を撤回した（`design-spec.md` §9）ので、公開サイト側の
 * 振れ幅はさらに大きくなる。ここを継ぎ直すと、作品を見るための器と、作品を並べる
 * 道具の区別がなくなる（`admin-renewal-goal.md` 軸4「高級感」/ 軸5「AI感の削減」）。
 */
import { describe, expect, test } from "bun:test";

const styles = await Bun.file(
  new URL("../styles.css", import.meta.url),
).text();

/** `セレクタ { ... }` を1ブロックだけ取り出す（入れ子のない宣言ブロック前提）。 */
function ruleBlock(selector: string): string {
  const head = `\n${selector} {`;
  const start = styles.indexOf(head);
  expect(start, `${selector} が styles.css に無い`).toBeGreaterThan(-1);
  const bodyStart = start + head.length;
  const end = styles.indexOf("\n}", bodyStart);
  expect(end, `${selector} の閉じ括弧が見つからない`).toBeGreaterThan(bodyStart);
  return styles.slice(bodyStart, end);
}

describe("管理画面の色は公開サイトから独立している", () => {
  test(".admin-atelier は公開サイトの色トークンを継がない", () => {
    const block = ruleBlock(".admin-atelier");
    expect(block).not.toContain("var(--background");
    expect(block).not.toContain("var(--foreground");
  });

  test("紙とインクは admin 自身の値として宣言されている", () => {
    const block = ruleBlock(".admin-atelier");
    expect(block).toContain("--admin-paper: #f7f7f7;");
    expect(block).toContain("--admin-ink: #1a1a1a;");
    expect(block).toContain("--admin-paper-rgb: 247, 247, 247;");
    expect(block).toContain("--admin-ink-rgb: 26, 26, 26;");
  });

  test("明暗の追従は残っている（機能を減らしていない）", () => {
    const dark = ruleBlock('[data-theme="dark"] .admin-atelier');
    expect(dark).toContain("--admin-paper: #121212;");
    expect(dark).toContain("--admin-ink: #e8e8e8;");
    // 公開サイトの [data-theme="dark"] 既定と同じ値であること。ずれると
    // 「暗くしたのに admin だけ別の黒」になる。
    const publicDark = ruleBlock('[data-theme="dark"]');
    expect(publicDark).toContain("--background: #121212;");
    expect(publicDark).toContain("--foreground: #e8e8e8;");
  });

  test("派生トークンは紙とインクから作り続けている（全部の直書きに逃げていない）", () => {
    const block = ruleBlock(".admin-atelier");
    for (const derived of [
      "--admin-paper-soft",
      "--admin-paper-deep",
      "--admin-muted",
      "--admin-line",
    ]) {
      const at = block.indexOf(`${derived}:`);
      expect(at, `${derived} が無い`).toBeGreaterThan(-1);
      expect(block.slice(at, at + 160)).toContain("color-mix");
    }
  });
});
