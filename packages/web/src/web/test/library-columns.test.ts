/**
 * Library の列数。
 *
 * 2026-08-24 実測（820px タッチ）で、**写真が1枚ずつしか並ばない**状態だった。
 * 原因は丸め: グリッドの実幅は 683.53px なのに `clientWidth` が 684 を返し、
 * そこから割り出した2列ぶんのタイルが 0.24px 太くなって、CSS の `auto-fill`
 * が1列へ落ちていた。**0.47px の丸め上げで画面の半分を失っていた。**
 *
 * 加えて列の選択肢が 2 と 3 しかなく、オーナーの「小さくなってもいいから
 * 5〜6列」に届かなかった。
 *
 * ここで縛るのは、**CSS・矢印キー・仮想スクロールが同じ列数を見ること**。
 * 別々に数えると ↑↓ の移動先が画面とずれる。
 */
import { describe, expect, test } from "bun:test";
import {
  LIBRARY_COLUMN_CHOICES,
  LIBRARY_MIN_DENSE_THUMB,
  libraryColumnCount,
  libraryGridTemplate,
} from "../pages/admin";

const GAP = 8;

describe("libraryColumnCount", () => {
  test("選んだ列数はそのまま通る", () => {
    for (const n of LIBRARY_COLUMN_CHOICES)
      expect(
        libraryColumnCount({ gridWidth: 684, thumbSize: 220, preferredColumns: n }),
      ).toBe(n);
  });

  test("選んでいなければサムネイル幅から数える（CSS の auto-fill と同じ式）", () => {
    const gridWidth = 1200;
    const thumbSize = 220;
    expect(libraryColumnCount({ gridWidth, thumbSize })).toBe(
      Math.floor((gridWidth + GAP) / (thumbSize + GAP)),
    );
  });

  test("詰めすぎは器の幅で頭打ちになる", () => {
    // 200px の器に6列は入らない。48px 下限で floor((200+8)/(48+8)) = 3。
    expect(
      libraryColumnCount({ gridWidth: 200, thumbSize: 220, preferredColumns: 6 }),
    ).toBe(3);
  });

  test("測る前（幅0）でも列数は1以上", () => {
    expect(libraryColumnCount({ gridWidth: 0, thumbSize: 220 })).toBe(1);
    expect(
      libraryColumnCount({ gridWidth: 0, thumbSize: 220, preferredColumns: 4 }),
    ).toBe(4);
  });

  test("390px の実測幅で6列まで届く（これが要望の下限）", () => {
    // 390px 端末のグリッド実幅は約 358px
    expect(
      libraryColumnCount({ gridWidth: 358, thumbSize: 220, preferredColumns: 6 }),
    ).toBe(6);
    expect(LIBRARY_MIN_DENSE_THUMB).toBeLessThanOrEqual(
      Math.floor((358 - GAP * 5) / 6),
    );
  });
});

describe("libraryGridTemplate", () => {
  test("選んだ列数は固定トラックで敷く（auto-fill に数え直させない）", () => {
    expect(
      libraryGridTemplate({ columns: 6, thumbSize: 51, explicit: true }),
    ).toBe("repeat(6, minmax(0, 1fr))");
  });

  test("選んでいなければ従来どおり auto-fill", () => {
    expect(
      libraryGridTemplate({ columns: 4, thumbSize: 220, explicit: false }),
    ).toBe("repeat(auto-fill, minmax(220px, 1fr))");
  });

  test("**固定トラックは器の実幅が小数でも列数が落ちない。**", () => {
    // これが今回の不具合の本体。auto-fill だと 683.53px で1列へ落ちていた。
    const template = libraryGridTemplate({
      columns: 2,
      thumbSize: 338,
      explicit: true,
    });
    expect(template).toBe("repeat(2, minmax(0, 1fr))");
    expect(template).not.toContain("auto-fill");
  });
});
