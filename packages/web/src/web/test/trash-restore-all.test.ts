/**
 * ゴミ箱の「すべて戻す」の回帰テストと、admin辞書の日英キー一致。
 *
 * ゴミ箱には写真を選ぶ仕組みが無く、まとめてできるのは「すべて完全削除」だけ
 * だった。復元は1枚ずつで、しかもPC幅ではマウスを乗せないとボタンが見えない。
 * 200枚戻すには200回狙うことになる。**まとめる入口が壊す側にしか無い**のが
 * 問題なので、戻す側にも同じ位置の入口を置いた。
 *
 * 併せて辞書の日英キー一致を機械で縛る。片方にだけ足す取りこぼしは、
 * 英語表示のときだけ undefined が出る形で表面化し、日本語で使っている
 * かぎり気づけない。
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ADMIN_DICTIONARY } from "../pages/admin-i18n";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, rel), "utf8");

/** ネストしたキーを "a.b.c" の形で平らに集める。 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("ゴミ箱の一括復元", () => {
  test("日本語と英語で辞書のキーが完全に一致する", () => {
    const ja = new Set(keyPaths(ADMIN_DICTIONARY.ja));
    const en = new Set(keyPaths(ADMIN_DICTIONARY.en));
    const missingInEn = [...ja].filter((k) => !en.has(k)).sort();
    const missingInJa = [...en].filter((k) => !ja.has(k)).sort();
    expect(missingInEn, "英語側に無いキー").toEqual([]);
    expect(missingInJa, "日本語側に無いキー").toEqual([]);
  });

  test("restoreAll は日英どちらにもあり、別の文言である", () => {
    // ゴミ箱の文言は phase2b.library.trash にある（この2階建ては既存の作り）。
    const ja = ADMIN_DICTIONARY.ja.phase2b.library.trash.restoreAll;
    const en = ADMIN_DICTIONARY.en.phase2b.library.trash.restoreAll;
    expect(typeof ja).toBe("string");
    expect(typeof en).toBe("string");
    expect(ja.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
    expect(ja).not.toBe(en);
  });

  /** ゴミ箱上部の帯（保持期間の注意 + まとめ操作）だけを切り出す。 */
  function trashBar(): string {
    const s = src("../pages/admin.tsx");
    const from = s.indexOf("copy.trash.retention");
    const to = s.indexOf("copy.trash.daysLeft");
    expect(from, "ゴミ箱の帯が見つからない").toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    return s.slice(from, to);
  }

  test("ゴミ箱の帯から、その場の全件を復元へ渡している", () => {
    const bar = trashBar();
    expect(bar).toContain("{copy.trash.restoreAll}");
    // 1枚ずつのボタンとは別に、帯の中で全件を渡していること。
    expect(bar).toContain("restorePhotos.mutate(");
    expect(bar).toContain("trashData!.photos.map((p) => p.id)");
  });

  test("戻す入口は、壊す入口より先に置く", () => {
    const bar = trashBar();
    // 逆順だと、目が最初に触れるまとめ操作が破壊側になる。
    expect(bar.indexOf("{copy.trash.restoreAll}")).toBeLessThan(
      bar.indexOf("{copy.trash.purgeAll}"),
    );
  });

  test("復元には確認を挟まない（取り返しがつくため）", () => {
    const s = src("../pages/admin.tsx");
    const bar = s.slice(
      s.indexOf("copy.trash.retention"),
      s.indexOf("copy.trash.daysLeft"),
    );
    // 確認ダイアログ(setPurgeConfirm)は完全削除の側にだけある。
    expect(bar).toContain("copy.trash.restoreAll");
    const restoreAt = bar.indexOf("copy.trash.restoreAll");
    const confirmAt = bar.indexOf("setPurgeConfirm");
    expect(confirmAt).toBeGreaterThan(restoreAt);
  });
});
