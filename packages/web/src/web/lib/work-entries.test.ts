/**
 * 「作品を見に行く」入口の行き先。
 *
 * Gallery に並べる写真が無いとき、TOP の導線を Gallery のままにすると、
 * 案内だけのページを経由させることになる。見られる作品があるなら直接送る。
 * **取得中・失敗を「0枚」として扱わない**のがいちばん大事な境目。
 */
import { test, expect, describe } from "bun:test";
import { galleryHasPhotos, workEntries } from "./work-entries";

const settings = {
  viewAllCtaLabel: "すべての作品を見る",
  viewAllLabel: "View all →",
  navLabelWork: "Work",
};
const base = {
  galleryExcludeSeries: true,
  seriesCount: 1,
  workCount: 1,
  seriesNearby: false,
  settings,
};

describe("Gallery に並べる写真があるか", () => {
  test("シリーズの写真を外す設定なら、単発の写真の数で決める", () => {
    expect(galleryHasPhotos({ total: 133, standalone: 0 }, true)).toBe(false);
    expect(galleryHasPhotos({ total: 133, standalone: 1 }, true)).toBe(true);
  });

  test("外さない設定なら、公開写真の数で決める", () => {
    expect(galleryHasPhotos({ total: 133, standalone: 0 }, false)).toBe(true);
    expect(galleryHasPhotos({ total: 0, standalone: 0 }, false)).toBe(false);
  });

  test("数が分からないうちは「ある」として扱う（取得中・失敗を0枚にしない）", () => {
    expect(galleryHasPhotos(undefined, true)).toBe(true);
    expect(galleryHasPhotos(undefined, false)).toBe(true);
  });
});

describe("作品を見に行く入口", () => {
  test("Gallery に写真があれば、今までどおり Gallery へ", () => {
    const entries = workEntries({ ...base, counts: { total: 5, standalone: 3 } });
    expect(entries.map((e) => [e.href, e.label, e.shortLabel])).toEqual([
      ["/gallery", "すべての作品を見る", "View all →"],
    ]);
  });

  test("数が分からないときも Gallery のまま（通信の失敗で行き先を変えない）", () => {
    expect(workEntries({ ...base, counts: undefined })[0]!.href).toBe("/gallery");
  });

  test("Gallery が0枚なら、中身のある棚へ置き換える", () => {
    const entries = workEntries({ ...base, counts: { total: 133, standalone: 0 } });
    expect(entries.map((e) => [e.href, e.label])).toEqual([
      ["/series", "シリーズを見る"],
      ["/work", "Workを見る"],
    ]);
  });

  test("棚の呼び方を変えていれば、その名前で誘う", () => {
    const entries = workEntries({
      ...base,
      counts: { total: 3, standalone: 0 },
      seriesCount: 0,
      settings: { ...settings, navLabelWork: "Commissions" },
    });
    expect(entries.map((e) => [e.href, e.label, e.shortLabel])).toEqual([
      ["/work", "Commissionsを見る", "Commissions →"],
    ]);
  });

  test("片方しか作品が無ければ、その入口だけ", () => {
    const only = workEntries({
      ...base,
      counts: { total: 3, standalone: 0 },
      workCount: 0,
    });
    expect(only.map((e) => e.href)).toEqual(["/series"]);
  });

  test("同じページに Series の帯が出ているなら、シリーズの入口は重ねない", () => {
    const entries = workEntries({
      ...base,
      counts: { total: 3, standalone: 0 },
      seriesNearby: true,
    });
    expect(entries.map((e) => e.href)).toEqual(["/work"]);
  });

  test("見に行ける作品がどこにも無ければ、入口を出さない", () => {
    expect(
      workEntries({
        ...base,
        counts: { total: 0, standalone: 0 },
        seriesCount: 0,
        workCount: 0,
      }),
    ).toEqual([]);
    // 帯で重複を省いた結果、残りが無くなった場合も同じ。
    expect(
      workEntries({
        ...base,
        counts: { total: 3, standalone: 0 },
        workCount: 0,
        seriesNearby: true,
      }),
    ).toEqual([]);
  });
});
