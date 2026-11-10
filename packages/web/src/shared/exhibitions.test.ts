import { describe, expect, test } from "bun:test";
import {
  EXHIBITION_NICHIGEI_SLUG,
  exhibitionEntries,
  exhibitionEntryPhotos,
  exhibitionSlugFromPath,
  exhibitionSortKey,
  newExhibitionSlug,
  publicExhibitions,
  readExhibitionArchive,
  writeExhibitionArchive,
} from "./exhibitions";

const record = (slug: string, dates: string, photoIds = "3,1") => ({
  slug,
  title: slug,
  dates,
  text: "",
  photoIds,
  captions: "",
});
const owner = { siteDesign: "develop", siteUrl: "https://akieguchi.com" };

describe("展示の欄", () => {
  test("会期の文から、並べる年と月を読む", () => {
    expect(exhibitionSortKey("日藝祭 2026年11月1日〜3日")).toBe(202611);
    expect(exhibitionSortKey("2025.10.3–5 京都")).toBe(202510);
    expect(exhibitionSortKey("２０２４年５月")).toBe(202405);
    expect(exhibitionSortKey("2024")).toBe(202400);
    expect(exhibitionSortKey("去年の秋")).toBe(0);
  });

  test("持ち主のサイトは、日藝祭の展示と足した展示が新しい順に並ぶ", () => {
    const settings = {
      ...owner,
      exhibitionArchive: JSON.stringify([record("2024-a", "2024年5月"), record("2027-b", "2027年1月"), record("ex-c", "")]),
    };
    expect(exhibitionEntries(settings).map((show) => show.slug)).toEqual([
      "2027-b",
      EXHIBITION_NICHIGEI_SLUG,
      "2024-a",
      "ex-c",
    ]);
  });

  test("保存値の無いサイトの住所は、サーバーが渡す住所で補える", () => {
    expect(publicExhibitions({ siteDesign: "develop" }, "https://akieguchi.com").map((show) => show.slug)).toEqual([
      EXHIBITION_NICHIGEI_SLUG,
    ]);
    expect(publicExhibitions({ siteDesign: "develop" }, "akieguchi.com")).toHaveLength(1);
  });

  test("ほかの人のサイト・今までの構成には、日藝祭の展示を出さない", () => {
    expect(exhibitionEntries({ siteDesign: "develop", siteUrl: "https://someone-else.example" }, "someone-else.example")).toEqual([]);
    expect(exhibitionEntries({ ...owner, siteDesign: "classic" })).toEqual([]);
    expect(exhibitionEntries(undefined)).toEqual([]);
  });

  test("写真を選んでいない展示は、公開に出さない", () => {
    const settings = { ...owner, exhibitionArchive: JSON.stringify([record("2025-a", "2025年3月", "")]) };
    expect(exhibitionEntries(settings)).toHaveLength(2);
    expect(publicExhibitions(settings).map((show) => show.slug)).toEqual([EXHIBITION_NICHIGEI_SLUG]);
  });

  test("足した展示の写真は、選んだ順のライブラリの写真だけ（無い写真は飛ばし、同梱の写真で埋めない）", () => {
    const [show] = exhibitionEntries({
      siteDesign: "develop",
      siteUrl: "https://someone-else.example",
      exhibitionArchive: JSON.stringify([record("2025-a", "2025年3月", "3,9,1")]),
    });
    expect(exhibitionEntryPhotos(show!, [{ id: 1 }, { id: 3 }]).map((photo) => photo.id)).toEqual([3, 1]);
    expect(exhibitionEntryPhotos(show!, [])).toEqual([]);
  });

  test("壊れた保存値・日藝祭と同じ slug・同じ slug の2件目は読まない", () => {
    expect(readExhibitionArchive("{")).toEqual([]);
    expect(readExhibitionArchive('{"slug":"a"}')).toEqual([]);
    const list = readExhibitionArchive(
      JSON.stringify([
        record(EXHIBITION_NICHIGEI_SLUG, "2026"),
        record("a", "2025"),
        record("a", "2024"),
        record("Bad Slug", "2023"),
        { slug: "b", title: " 題\n名 ", photoIds: "5,-2,x,5" },
      ]),
    );
    expect(list.map((entry) => entry.slug)).toEqual(["a", "b"]);
    expect(list[1]).toMatchObject({ title: "題 名", dates: "", photoIds: "5" });
    expect(readExhibitionArchive(writeExhibitionArchive(list))).toEqual(list);
    expect(writeExhibitionArchive([])).toBe("");
  });

  test("新しい slug は、会期の年が読めれば頭に付け、重なったら番号を足す", () => {
    expect(newExhibitionSlug([], "mh2abc9k")).toBe("ex-2abc9k");
    expect(newExhibitionSlug([], "ex-2abc9k", "〇〇ギャラリー 2025年10月")).toBe("2025-2abc9k");
    expect(newExhibitionSlug(["2025-2abc9k"], "ex-2abc9k", "2025")).toBe("2025-2abc9k-2");
  });

  test("住所から slug を読む", () => {
    expect(exhibitionSlugFromPath("/exhibition/2026-nichigei")).toBe("2026-nichigei");
    expect(exhibitionSlugFromPath("/exhibition/2026-nichigei/")).toBe("2026-nichigei");
    expect(exhibitionSlugFromPath("/exhibition")).toBeNull();
    expect(exhibitionSlugFromPath("/exhibition/a/b")).toBeNull();
    expect(exhibitionSlugFromPath("/exhibition/A")).toBeNull();
  });
});
