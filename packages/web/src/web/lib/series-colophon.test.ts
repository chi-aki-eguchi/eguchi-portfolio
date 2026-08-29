import { describe, expect, test } from "bun:test";
import {
  colophonHasSubstance,
  formatPeriodRange,
  isMeaningfulGear,
  isMeaningfulNumber,
  seriesColophon,
  tidyCameraName,
  tidyLensName,
  type ColophonPhoto,
} from "./series-colophon";

const p = (o: Partial<ColophonPhoto>): ColophonPhoto => ({ ...o });

describe("seriesColophon", () => {
  test("写真が無ければ何も述べない", () => {
    expect(seriesColophon([])).toBeNull();
  });

  test("枚数・媒体・カメラ・レンズをまとめる", () => {
    const c = seriesColophon([
      p({ camera: "SONY ILCE-1", lens: "FE 50mm F1.2 GM", filmType: "デジタル", shotAt: "2024-08-19T13:47:04" }),
      p({ camera: "SONY ILCE-1", lens: "FE 135mm F1.8 GM", filmType: "デジタル", shotAt: "2024-08-20T09:00:00" }),
    ])!;
    expect(c.count).toBe(2);
    expect(c.cameras).toEqual(["SONY ILCE-1"]);
    expect(c.lenses).toEqual(["FE 135mm F1.8 GM", "FE 50mm F1.2 GM"]);
    expect(c.medium).toBe("デジタル");
    expect(c.period).toBe("2024年8月");
  });

  describe("期間", () => {
    const period = (dates: (string | null)[]) =>
      seriesColophon(dates.map((d) => p({ shotAt: d })))!.period;

    test("同じ月なら1つだけ書く", () => {
      expect(period(["2024-08-01T00:00:00", "2024-08-31T23:00:00"])).toBe("2024年8月");
    });

    test("同じ年なら年を繰り返さない", () => {
      expect(period(["2024-08-19T00:00:00", "2024-11-02T00:00:00"])).toBe("2024年8月–11月");
    });

    test("年をまたぐときは両方書く", () => {
      expect(period(["2024-08-19T00:00:00", "2025-03-02T00:00:00"])).toBe("2024年8月–2025年3月");
    });

    test("並び順に依存しない", () => {
      expect(period(["2025-03-02T00:00:00", "2024-08-19T00:00:00"])).toBe("2024年8月–2025年3月");
    });

    test("撮影日が無い写真は期間の計算から外す", () => {
      expect(period([null, "2024-08-19T00:00:00", null])).toBe("2024年8月");
      expect(period([null, null])).toBeNull();
    });

    test("月末の1枚がタイムゾーンで隣の月へ動かない", () => {
      // `new Date("2024-08-31T23:30:00")` は環境のタイムゾーンで解釈され、
      // UTC+X の環境では9月になる。年月は文字列から取っている。
      expect(period(["2024-08-31T23:30:00"])).toBe("2024年8月");
      expect(period(["2024-01-01T00:30:00"])).toBe("2024年1月");
    });
  });

  test("フィルムとデジタルが混ざる作品群は両方述べる", () => {
    const c = seriesColophon([
      p({ filmType: "フィルム" }),
      p({ filmType: "デジタル" }),
      p({ filmType: "フィルム" }),
    ])!;
    expect(c.medium).toBe("デジタル・フィルム");
  });

  test("空文字と空白だけの値は無いものとして扱う", () => {
    const c = seriesColophon([
      p({ camera: "", lens: "   ", filmType: "", shotAt: "" }),
      p({ camera: "Contax T2", lens: null }),
    ])!;
    expect(c.cameras).toEqual(["Contax T2"]);
    expect(c.lenses).toEqual([]);
    expect(c.medium).toBeNull();
    expect(c.period).toBeNull();
  });

  test("レンズが多すぎるときは並べきらず、残りの本数を持つ", () => {
    const lenses = ["a", "b", "c", "d", "e", "f", "g"];
    const c = seriesColophon(lenses.map((l) => p({ lens: l })))!;
    expect(c.lenses.length).toBe(5);
    expect(c.lensesOmitted).toBe(2);
  });

  test("同じレンズを何枚使っても1本として数える", () => {
    const c = seriesColophon([
      p({ lens: "FE 50mm F1.2 GM" }),
      p({ lens: "FE 50mm F1.2 GM" }),
      p({ lens: " FE 50mm F1.2 GM " }),
    ])!;
    expect(c.lenses).toEqual(["FE 50mm F1.2 GM"]);
    expect(c.lensesOmitted).toBe(0);
  });
});

describe("colophonHasSubstance", () => {
  test("枚数しか分からない作品群には奥付を出さない", () => {
    const c = seriesColophon([p({}), p({})]);
    expect(c!.count).toBe(2);
    expect(colophonHasSubstance(c)).toBe(false);
  });

  test("何か1つでも分かれば出す", () => {
    expect(colophonHasSubstance(seriesColophon([p({ filmType: "フィルム" })]))).toBe(true);
    expect(colophonHasSubstance(seriesColophon([p({ shotAt: "2024-08-01T00:00:00" })]))).toBe(true);
    expect(colophonHasSubstance(seriesColophon([p({ camera: "Contax T2" })]))).toBe(true);
  });

  test("写真そのものが無ければ出さない", () => {
    expect(colophonHasSubstance(null)).toBe(false);
  });
});

describe("tidyLensName", () => {
  test("Sigma の製品ライン型番だけを落とす", () => {
    expect(tidyLensName("24-70mm F2.8 DG DN | Art 019")).toBe("24-70mm F2.8 DG DN");
    expect(tidyLensName("85mm F1.4 DG DN | Art 020")).toBe("85mm F1.4 DG DN");
    expect(tidyLensName("150-600mm F5-6.3 DG DN OS | Sports 021")).toBe(
      "150-600mm F5-6.3 DG DN OS",
    );
    expect(tidyLensName("65mm F2 DG DN | Contemporary 020")).toBe("65mm F2 DG DN");
  });

  test("それ以外の名前には触れない", () => {
    for (const name of [
      "FE 50mm F1.2 GM",
      "XF 35mm F1.4 R",
      "Planar T* 45mm F2",
      "Lens | Special Edition", // 型番ではないので残す
      "24-70mm | Art", // 数字が無いので残す
    ])
      expect(tidyLensName(name)).toBe(name);
  });

  test("同じレンズが型番の有無で二重に並ばない", () => {
    const c = seriesColophon([
      { lens: "24-70mm F2.8 DG DN | Art 019" },
      { lens: "24-70mm F2.8 DG DN" },
    ])!;
    expect(c.lenses).toEqual(["24-70mm F2.8 DG DN"]);
  });
});

describe("formatPeriodRange", () => {
  // 一覧の札は写真を持たず、APIの min/max しか持たない。
  test("min/max から同じ見出しを組める", () => {
    expect(formatPeriodRange("2024-08-19T13:47:04", "2025-08-02T09:00:00")).toBe(
      "2024年8月–2025年8月",
    );
    expect(formatPeriodRange("2024-12-01T00:00:00", "2025-01-09T00:00:00")).toBe(
      "2024年12月–2025年1月",
    );
    expect(formatPeriodRange("2024-08-01T00:00:00", "2024-08-31T00:00:00")).toBe(
      "2024年8月",
    );
  });

  test("片方しか無くても組む。両方無ければ出さない", () => {
    expect(formatPeriodRange("2024-08-19T00:00:00", null)).toBe("2024年8月");
    expect(formatPeriodRange(null, "2024-08-19T00:00:00")).toBe("2024年8月");
    expect(formatPeriodRange(null, null)).toBeNull();
    expect(formatPeriodRange(undefined, undefined)).toBeNull();
    expect(formatPeriodRange("", "")).toBeNull();
  });
});

/**
 * 2026-08-29、全497点で奥付を出したところ、公開ページに
 * `----`・`0.0 mm f/0.0`・`NIKON CORPORATION NIKON Z f` が並んだ。
 * どれも EXIF がそのまま持っている値で、作品の事実ではない。
 */
describe("EXIF の汚れ", () => {
  test("機材が分からないことを表す値は、機材名として並べない", () => {
    for (const junk of ["----", "-----", "0.0 mm f/0.0", "0 mm", "", "   ", "Unknown", "n/a", "0.0mm F0.0"]) {
      expect(isMeaningfulGear(junk)).toBe(false);
    }
    for (const real of ["FE 50mm F1.2 GM", "SONY ILCE-1", "24-70mm F2.8 DG DN", "Ai Nikkor 50mm f/1.4S"]) {
      expect(isMeaningfulGear(real)).toBe(true);
    }
    expect(isMeaningfulGear(null)).toBe(false);
    expect(isMeaningfulGear(undefined)).toBe(false);
  });

  test("桁がすべて 0 の数値は出さない。ふつうの値は残す", () => {
    for (const junk of ["0", "0.0", "f/0.0", "0.0 mm", "ISO 0", "", "mm"]) {
      expect(isMeaningfulNumber(junk)).toBe(false);
    }
    for (const real of ["1/125", "50 mm", "f/1.2", "ISO 400", "1.3"]) {
      expect(isMeaningfulNumber(real)).toBe(true);
    }
  });

  test("繰り返されたメーカー名だけを落とす", () => {
    expect(tidyCameraName("NIKON CORPORATION NIKON Z f")).toBe("NIKON Z f");
    expect(tidyCameraName("NIKON CORPORATION NIKON Z6_3")).toBe("NIKON Z6_3");
    expect(tidyCameraName("Canon Canon EOS R5")).toBe("Canon EOS R5");
    // 繰り返しが無ければ触らない
    expect(tidyCameraName("SONY ILCE-1")).toBe("SONY ILCE-1");
    expect(tidyCameraName("FUJIFILM X-T5")).toBe("FUJIFILM X-T5");
    // 知らない書き方を削らない（最後の語が同じでも、名前が消えては困る）
    expect(tidyCameraName("RICOH IMAGING COMPANY LTD PENTAX K-3")).toBe(
      "RICOH IMAGING COMPANY LTD PENTAX K-3",
    );
  });

  test("奥付は汚れた値を並べない", () => {
    const c = seriesColophon([
      p({ camera: "NIKON CORPORATION NIKON Z f", lens: "----", shotAt: "2025-03-01T00:00:00" }),
      p({ camera: "NIKON CORPORATION NIKON Z f", lens: "0.0 mm f/0.0", shotAt: "2025-03-02T00:00:00" }),
      p({ camera: "NIKON CORPORATION NIKON Z f", lens: "Ai Nikkor 50mm f/1.4S", shotAt: "2025-03-03T00:00:00" }),
    ])!;
    expect(c.cameras).toEqual(["NIKON Z f"]);
    expect(c.lenses).toEqual(["Ai Nikkor 50mm f/1.4S"]);
  });

  test("レンズ名の整理はこれまでどおり効く", () => {
    expect(tidyLensName("24-70mm F2.8 DG DN | Art 019")).toBe("24-70mm F2.8 DG DN");
  });
});
