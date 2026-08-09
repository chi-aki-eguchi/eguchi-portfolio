/**
 * 2026-08-09 オーナー依頼の回帰テスト。
 *
 * 1. 並び替えに「ランダム」を足す（公開ギャラリー／管理画面の一覧の両方）
 * 2. ギャラリーからシリーズ所属の写真を外せるようにする
 * 3. HERO をランダムにする（選んだ写真の順だけ／公開写真全体から の2種）
 * 4. マソンリーの「3列」という説明は嘘だった
 *
 * ランダムで一番こわいのは「見ている最中に並びが変わる」こと。特に戻ったとき、
 * 復元したスクロール位置に別の写真が来ると、B-18 で枚数と位置まで復元した
 * 意味が無くなる。だからタブ内では同じ並びになることを縛る。
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { shuffleWithSeed, visitShuffleSeed } from "../lib/shuffle";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { columnsThatFit } from "../../shared/gallery-metrics";

const src = (p: string) =>
  readFileSync(new URL(p, import.meta.url).pathname, "utf8");

const photos = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  sortOrder: i,
  shotAt: null,
  createdAt: null,
}));

describe("ランダム並び", () => {
  test("同じ種なら何度並べても同じ順になる", () => {
    const a = shuffleWithSeed(photos, 12345).map((p) => p.id);
    const b = shuffleWithSeed(photos, 12345).map((p) => p.id);
    expect(a).toEqual(b);
  });

  test("種が違えば別の順になる", () => {
    const a = shuffleWithSeed(photos, 1).map((p) => p.id);
    const b = shuffleWithSeed(photos, 2).map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  test("並べ替えても写真は増えも減りもしない", () => {
    const out = shuffleWithSeed(photos, 99);
    expect(out).toHaveLength(photos.length);
    expect(new Set(out.map((p) => p.id)).size).toBe(photos.length);
  });

  test("元の配列を書き換えない", () => {
    const before = photos.map((p) => p.id);
    shuffleWithSeed(photos, 7);
    expect(photos.map((p) => p.id)).toEqual(before);
  });

  test("タブ内で共有する種は一度決まったら変わらない", () => {
    // ページを移って戻っても同じ並びに戻るための約束。
    expect(visitShuffleSeed()).toBe(visitShuffleSeed());
  });

  test("gallerySortOrder=random は、同じタブで呼び直しても同じ順を返す", () => {
    const a = sortPhotosBySetting(photos, "random").map((p) => p.id);
    const b = sortPhotosBySetting(photos, "random").map((p) => p.id);
    expect(a).toEqual(b);
    // 手動順とは違う並びになっていること（＝実際に効いている）
    expect(a).not.toEqual(photos.map((p) => p.id));
  });

  test("既存の並び順は今までどおり", () => {
    expect(sortPhotosBySetting(photos, "manual").map((p) => p.id)).toEqual(
      photos.map((p) => p.id),
    );
    expect(sortPhotosBySetting(photos, undefined).map((p) => p.id)).toEqual(
      photos.map((p) => p.id),
    );
  });

  test("管理画面の一覧のランダムも同じ種を使う", () => {
    const admin = src("../pages/admin.tsx");
    expect(admin).toContain('librarySort === "random"');
    expect(admin).toContain("shuffleWithSeed(list, visitShuffleSeed())");
  });
});

describe("ギャラリーからシリーズの写真を外す", () => {
  test("既定は今までどおり出す", () => {
    const api = src("../../api/index.ts");
    expect(api).toContain('settings.galleryExcludeSeries ?? "off"');
  });

  test("on のときだけ seriesId を持つ写真を落とす", () => {
    const gallery = src("../pages/gallery.tsx");
    expect(gallery).toContain(
      '(settings?.galleryExcludeSeries ?? "off") === "on"',
    );
    expect(gallery).toContain("list.filter((p) => p.seriesId == null)");
  });
});

describe("HERO のランダム", () => {
  test("2種とも実装されている", () => {
    const top = src("../pages/top.tsx");
    expect(top).toContain('heroRandom === "any"');
    expect(top).toContain('heroRandom === "shuffle"');
    // 種はタブ共有。描き直しのたびに引き直すと見ている最中に入れ替わる。
    expect(top).toContain("visitShuffleSeed()");
  });

  test("既定は off（選んだ順のまま）", () => {
    const api = src("../../api/index.ts");
    expect(api).toContain('settings.heroRandom ?? "off"');
  });
});

describe("列数の説明", () => {
  test("マソンリーの説明から「3列」を消した", () => {
    const i18n = src("../pages/admin-i18n.tsx");
    // 「3列・縦横比を保って敷き詰め」は嘘だった。マソンリーも最大列数に従う。
    expect(i18n).not.toContain("3列・縦横比を保って敷き詰め");
    expect(i18n).not.toContain("Three columns, packed tightly");
  });

  test("最小タイル幅は1か所だけに置く", () => {
    // 公開サイトと管理画面の説明が同じ数値を読むため。片方だけ変えると、
    // 管理画面が「最大◯列」と嘘を言う。
    const gallery = src("../components/PhotoGallery.tsx");
    expect(gallery).toContain("GALLERY_MIN_TILE_DESKTOP");
    expect(gallery).not.toMatch(/\(isMobile \? 150 : 210\)/);
  });

  test("狭い幅では最大列数まで届かないことを数えられる", () => {
    // 設定プレビューの幅（最大約780px）だと、写真の大きさ1.0で3列まで。
    expect(
      columnsThatFit({
        width: 780 - 32,
        sizeScale: 1,
        maxColumns: 8,
        isMobile: false,
      }),
    ).toBe(3);
    // 写真を小さくすれば同じ幅でも増える。
    expect(
      columnsThatFit({
        width: 780 - 32,
        sizeScale: 0.5,
        maxColumns: 8,
        isMobile: false,
      }),
    ).toBe(7);
    // 広い幅なら最大列数で頭打ち。
    expect(
      columnsThatFit({
        width: 2000,
        sizeScale: 1,
        maxColumns: 8,
        isMobile: false,
      }),
    ).toBe(8);
  });

  test("届かないときだけ理由を出す", () => {
    const tabs = src("../pages/admin-tabs.tsx");
    expect(tabs).toContain("columnsCappedByPreview");
    expect(tabs).toContain("if (!(previewWidth > 0) || fits >= maxColumns)");
  });
});
