import { describe, expect, test } from "bun:test";
import {
  captureFacts,
  cleanGearValue,
  indexablePhotoIds,
  indexablePhotoNeighbours,
  isIndexablePhoto,
  photoPageDescription,
  photoPageParagraphs,
  photoPageTitle,
} from "./photo-page-text";

describe("cleanGearValue", () => {
  // 公開データに実在した `----` / `0.0 mm f/0.0` は、どちらも
  // 「読めなかった」の意味で、
  // レンズ名ではない。**そのまま出すと嘘になる。**
  test("EXIF から入った読めない値を落とす", () => {
    expect(cleanGearValue("----")).toBe("");
    expect(cleanGearValue("-")).toBe("");
    expect(cleanGearValue("0.0 mm f/0.0")).toBe("");
    expect(cleanGearValue("0")).toBe("");
    expect(cleanGearValue("  ")).toBe("");
    expect(cleanGearValue(null)).toBe("");
  });

  test("本物の機材名は落とさない", () => {
    expect(cleanGearValue("FE 50mm F1.2 GM")).toBe("FE 50mm F1.2 GM");
    expect(cleanGearValue(" SONY ILCE-1 ")).toBe("SONY ILCE-1");
    // 先頭が 0 でも、0mm でなければ残す
    expect(cleanGearValue("70-200mm F2.8")).toBe("70-200mm F2.8");
  });
});

describe("captureFacts", () => {
  test("入っている欄だけを並べ、単位を補う", () => {
    expect(
      captureFacts({
        camera: "SONY ILCE-1",
        lens: "FE 50mm F1.2 GM",
        fNumber: "1.2",
        exposureTime: "1/2000",
        iso: "100",
      }),
    ).toEqual(["SONY ILCE-1", "FE 50mm F1.2 GM", "f1.2", "1/2000秒", "ISO 100"]);
  });

  test("単位が既に付いていれば二重にしない", () => {
    expect(
      captureFacts({ fNumber: "f2.8", exposureTime: "1/60秒", iso: "ISO 400" }),
    ).toEqual(["f2.8", "1/60秒", "ISO 400"]);
    expect(captureFacts({ exposureTime: "1/8000s" })).toEqual(["1/8000秒"]);
    expect(captureFacts({ exposureTime: "1/125 sec" })).toEqual(["1/125秒"]);
  });

  // フィルム写真280枚は機材欄が全部空。**空欄だけの行を作らない。**
  test("機材が何も無ければ空", () => {
    expect(captureFacts({ camera: null, lens: "----" })).toEqual([]);
  });
});

describe("photo search indexability", () => {
  const substantive =
    "雨上がりの路地で、傘を閉じた人が店先の光を横切った瞬間を記録した一枚です。";

  test("人が付けた固有題と十分な説明が揃うまで検索対象にしない", () => {
    expect(isIndexablePhoto({ title: "", description: substantive })).toBe(false);
    expect(isIndexablePhoto({ title: "雨の路地", description: "短い説明" })).toBe(false);
    expect(isIndexablePhoto({ title: substantive, description: substantive })).toBe(false);
    expect(isIndexablePhoto({ title: "雨の路地", description: substantive })).toBe(true);
  });

  test("題または説明を使い回した写真はまとめて検索対象から外す", () => {
    const ids = indexablePhotoIds([
      { id: 1, title: "雨の路地", description: substantive },
      { id: 2, title: "雨の路地", description: `${substantive}別の場面。` },
      {
        id: 3,
        title: "海辺の午後",
        description: "雲の切れ間から光が差し、波打ち際を歩く人の影が長く伸びた一枚です。",
      },
      {
        id: 4,
        title: "午後の海辺",
        description: "雲の切れ間から光が差し、波打ち際を歩く人の影が長く伸びた一枚です。",
      },
      {
        id: 5,
        title: "藍の窓",
        description: "藍染めの布が風を受け、窓から入る午後の光の中でゆっくり揺れている一枚です。",
      },
    ]);
    expect([...ids]).toEqual([5]);
  });

  test("前後リンクは編集済み代表作だけを結び、薄い写真からは辿らせない", () => {
    const photos = [
      { id: 1, title: "代表作A", description: `${substantive} A` },
      { id: 2, title: "", description: "" },
      { id: 3, title: "代表作B", description: `${substantive} B` },
    ];
    expect(indexablePhotoNeighbours(photos, 1)).toEqual({ prev: null, next: 3 });
    expect(indexablePhotoNeighbours(photos, 2)).toEqual({ prev: null, next: null });
    expect(indexablePhotoNeighbours(photos, 3)).toEqual({ prev: 1, next: null });
  });
});

describe("photoPageTitle / Description", () => {
  const ctx = { photographerName: "江口秋", seriesName: "Ishigaki Island" };

  test("題も説明も空の写真でも、1枚ごとに違う題になる", () => {
    const a = photoPageTitle({ shotAt: "2024-08-19T13:47:04" }, ctx);
    const b = photoPageTitle({ shotAt: "2025-01-02T09:11:24" }, ctx);
    expect(a).toContain("Ishigaki Island");
    expect(a).toContain("2024年8月");
    expect(b).toContain("2025年1月");
    expect(a).not.toBe(b);
  });

  test("説明文は題に機材とフィルム／デジタルを足す", () => {
    const d = photoPageDescription(
      { shotAt: "2024-08-19", filmType: "デジタル", camera: "SONY ILCE-1" },
      ctx,
    );
    expect(d).toContain("デジタル");
    expect(d).toContain("SONY ILCE-1");
    expect(d.endsWith("。")).toBe(true);
  });

  test("検索対象にした根拠の編集済み説明を meta description に残す", () => {
    const description =
      "雨上がりの路地で、傘を閉じた人が店先の光を横切った瞬間を記録した一枚です。";
    const d = photoPageDescription(
      { title: "雨の路地", description, camera: "SONY ILCE-1" },
      ctx,
    );
    expect(d).toContain("雨の路地");
    expect(d).toContain(description);
    expect(d).toContain("SONY ILCE-1");
  });

  test("足せる事実が無ければ題だけで終わる（空の説明文を出さない）", () => {
    const d = photoPageDescription({ shotAt: "2024-08-19" }, ctx);
    expect(d).toBe(`${photoPageTitle({ shotAt: "2024-08-19" }, ctx)}。`);
  });
});

describe("photoPageParagraphs", () => {
  test("シリーズと機材があれば2段落", () => {
    expect(
      photoPageParagraphs(
        { shotAt: "2024-08-19", filmType: "デジタル", camera: "SONY ILCE-1" },
        { seriesName: "Ishigaki Island" },
      ),
    ).toEqual(["シリーズ「Ishigaki Island」の1枚。", "デジタル / SONY ILCE-1"]);
  });

  test("編集済み説明を JS なしの本文にも残す", () => {
    const description =
      "雨上がりの路地で、傘を閉じた人が店先の光を横切った瞬間を記録した一枚です。";
    const seriesLine = "シリーズ「Tokyo」の1枚。";
    expect(
      photoPageParagraphs(
        { title: "雨の路地", description },
        { seriesName: "Tokyo" },
      ),
    ).toEqual([description, seriesLine]);
  });

  // 425枚はシリーズ無し。**空の段落を並べない。**
  test("何も無ければ段落を作らない", () => {
    expect(photoPageParagraphs({ shotAt: null }, {})).toEqual([]);
  });
});
