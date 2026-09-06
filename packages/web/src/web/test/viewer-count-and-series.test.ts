/**
 * ビューアまわりの2件の回帰テスト。
 *
 * 1. 分母が「いま描き終えている枚数」だった。ギャラリーは最初にパソコンで24枚・
 *    スマホで12枚しか描かないので、497枚あるサイトでも1枚目を開くと「1 / 24」と
 *    出て、スクロールで読み足すたびに 36、48 と増えた。見ている最中に総数が動くと、
 *    どこまで見たかの手がかりにならない。
 * 2. トップページのビューアにシリーズ名と行き先を渡していなかった。同じ写真を
 *    ギャラリーで開けば作品群へ入れるのに、トップで開くと行き止まりだった。
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const lightbox = src("../components/Lightbox.tsx");
const grid = src("../components/PhotoGallery.tsx");
const gallery = src("../pages/gallery.tsx");
const top = src("../pages/top.tsx");

describe("ビューアの枚数", () => {
  test("分母は描画済みではなく、渡された総数を使う", () => {
    expect(lightbox).toContain(
      "{index + 1} / {Math.max(totalCount ?? 0, photos.length)}",
    );
    // 渡されなかった場合に 0 を出さないこと（従来どおり描画済みに倒す）。
    expect(lightbox).not.toContain("{index + 1} / {totalCount}");
  });

  test("総数はギャラリーから一覧部品を通ってビューアまで届く", () => {
    expect(gallery).toContain("totalCount={filtered.length}");
    expect(grid).toContain("totalCount={totalCount}");
  });

  test("トップも作品プールの総数を渡す", () => {
    // 「もっと見る」で増える前から、全体が何枚かが分かる。
    const uses = [...top.matchAll(/totalCount=\{[^}]+\}/g)].map((m) => m[0]);
    expect(uses.length, "トップの一覧が総数を渡していない").toBe(4);
    for (const u of uses) expect(u).toMatch(/worksPool/);
  });
});

describe("トップで開いた写真からシリーズへ行けるか", () => {
  test("トップの一覧すべてにシリーズの対応表を渡す", () => {
    expect(
      (top.match(/seriesNameById=\{seriesNameById\}/g) ?? []).length,
      "トップの一覧がシリーズ名を渡していない",
    ).toBe(4);
    expect(
      (top.match(/seriesSlugById=\{seriesSlugById\}/g) ?? []).length,
    ).toBe(4);
  });

  test("シリーズは既存の鍵で引く（新しい通信を増やさない）", () => {
    // ナビと SeriesStream が同じ鍵で引いているので、キャッシュを共有する。
    expect(top).toContain('queryKey: ["series"]');
    expect(src("../components/SeriesStream.tsx")).toContain(
      'queryKey: ["series"]',
    );
  });
});

describe("取り込みの入口", () => {
  const admin = src("../pages/admin.tsx");

  test("ファイル選択欄は取り込み開始時に空へ戻す", () => {
    // 戻さないと、同じ写真をもう一度選んでも onChange が発火せず、進捗も
    // エラーも出ないまま無反応になる（取り込みに失敗して選び直すときに踏む）。
    expect(admin).toContain('event.target.value = ""');
    const i = admin.indexOf('event.target.value = ""');
    const j = admin.indexOf("handleFiles(picked)");
    expect(j, "handleFiles を呼んでいない").toBeGreaterThan(-1);
    // 空へ戻すのは handleFiles より先（後だと選択内容を読めない）。
    expect(i).toBeLessThan(j);
  });

  test("取り込み進捗に英語の直書きを残さない", () => {
    expect(admin).not.toContain("Importing {");
    expect(admin).toContain("copy.import.progress(");
  });
});

describe("決済先から戻った購入案内", () => {
  const start = src("../pages/service-start.tsx");

  test("プラン名と金額を直書きしない", () => {
    // このページは決済照合を行わないため、支払い金額を断定しない。
    expect(start).not.toContain("¥30,000");
    expect(start).not.toContain("purchasedPlanFrom(");
  });

  test("URLだけで購入済みのプラン行を組み立てない", () => {
    // thanks や plan は閲覧者が書き換えられる。受け取り案内は表示しても、
    // 未検証の購入プラン・支払い済み金額をその値から復元してはいけない。
    expect(start).not.toContain("const planRow = plan");
    expect(start).not.toContain("params.get(\"plan\")");
  });
});
