/**
 * 先読みが失敗を握りつぶさないことの回帰テスト。
 *
 * `main.tsx` はギャラリーとTOPを開いたとき、写真・カテゴリ・Hero写真を
 * 先読みしてキャッシュへ入れる。ここが素の `.json()` だと、APIが500を
 * 返したとき `{error: "..."}` がそのまま ["photos"] のキャッシュに入る。
 * staleTime が60秒あるので、後から描画するギャラリーはそれを新鮮な
 * データとして扱い、再取得もエラー表示もしない。画面には「No photos」
 * とだけ出て、写真が消えたようにしか見えず、再読み込みの導線も無い。
 *
 * gallery.tsx には ContentStatus による「取得に失敗した」経路がある。
 * 先読みが投げれば正しくそちらへ落ちるので、投げることを縛る。
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../main.tsx", import.meta.url).pathname,
  "utf8",
);

describe("main.tsx の先読み", () => {
  test("prefetchQuery の queryFn は必ず jsonOrThrow を通す", () => {
    const queryFns = Array.from(
      source.matchAll(/queryFn:\s*async\s*\(\)\s*=>\s*([^,\n]+)/g),
      ([, body]) => body.trim(),
    );
    expect(queryFns.length).toBeGreaterThan(0);
    for (const body of queryFns) {
      expect(body).toContain("jsonOrThrow");
    }
  });

  test("応答を検証しない素の .json() が残っていない", () => {
    // `(await api.foo.$get()).json()` の形。これがあると失敗が
    // 正常なデータとしてキャッシュへ入る。
    expect(source).not.toMatch(/\(await api[^)]*\$get\([^)]*\)\)\.json\(\)/);
  });

  test("キャッシュが新鮮なままになる staleTime が効いている前提を残す", () => {
    // staleTime が 0 ならギャラリー側が必ず取り直すので、この不具合は
    // 表に出ない。60秒あることがこの回帰テストの前提。
    expect(source).toMatch(/staleTime:\s*60_000/);
  });
});
