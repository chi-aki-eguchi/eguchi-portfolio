import { test, expect } from "bun:test";
import { seriesHref, seriesLinksById } from "./series-links";

test("Work 棚の1本は /work/<slug> を指す（/series/<slug> はサーバーが404を返す）", () => {
  expect(seriesHref({ slug: "rintaro", kind: "work" })).toBe("/work/rintaro");
  expect(seriesHref({ slug: "sicf", kind: "series" })).toBe("/series/sicf");
});

test("kind の無い古い応答は Series 棚として扱う", () => {
  expect(seriesHref({ slug: "sicf" })).toBe("/series/sicf");
  expect(seriesHref({ slug: "sicf", kind: null })).toBe("/series/sicf");
});

test("slug は URL として安全な形で入れる", () => {
  expect(seriesHref({ slug: "石垣 島", kind: "series" })).toBe(
    "/series/" + encodeURIComponent("石垣 島"),
  );
});

test("両方の棚をまとめて id → 名前と行き先にする", () => {
  const map = seriesLinksById(
    [{ id: 1, slug: "sicf", title: "SICF Fukuoka", kind: "series" }],
    [{ id: 5, slug: "rintaro", title: "Rintaro Otsuka", kind: "work" }],
  );
  expect(map[1]).toEqual({ name: "SICF Fukuoka", href: "/series/sicf" });
  expect(map[5]).toEqual({ name: "Rintaro Otsuka", href: "/work/rintaro" });
});

test("片方がまだ届いていなくても、届いている棚だけで動く", () => {
  const map = seriesLinksById(undefined, [
    { id: 5, slug: "rintaro", title: "Rintaro Otsuka", kind: "work" },
  ]);
  expect(Object.keys(map)).toEqual(["5"]);
  expect(seriesLinksById(undefined, undefined)).toEqual({});
});

test("同じ id が両方に来ても、先に渡した棚の行き先を保つ", () => {
  const map = seriesLinksById(
    [{ id: 3, slug: "a", title: "A", kind: "series" }],
    [{ id: 3, slug: "a", title: "A", kind: "work" }],
  );
  expect(map[3].href).toBe("/series/a");
});
