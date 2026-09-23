/**
 * 写真集の骨格（siteDesign = "book"、2026-09-23 試作）。
 *
 * ここで縛るのは、見た目ではなく**事実と行き先**の4点。
 *  1. ベタ焼きの媒体は写真1枚ずつの記録どおり。デジタルの写真をフィルムの
 *     帯に入れない（オーナー指示「事実と違う見せ方はしない」）
 *  2. コマ番号・頁番号・番地（#p-07）は作品ページと同じ並びから出す。
 *     目次から開いた先が別の写真にならない
 *  3. 期間はデジタルの撮影日だけから組む（フィルムの shotAt は複写日時）
 *  4. 設定が無いサイト（配布版の既定）は今までの骨格のまま
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";
import {
  bookFacts,
  mediumRuns,
  pageIndexFromHash,
  siteDesignFrom,
} from "../lib/book";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router, Route } = await import("wouter");
const SeriesListPage = (await import("../pages/series")).default;
const { titlePhoto } = await import("../components/book/BookHome");
const SeriesDetailPage = (await import("../pages/series-detail")).default;

const doc = dom.window.document;

const photo = (
  id: number,
  filmType: string | null,
  sortOrder: number,
  shotAt: string,
) => ({
  id,
  url: `/api/images/photos/p${id}.jpg`,
  thumbUrl: `/api/images/thumbs/p${id}.webp`,
  width: 2560,
  height: 3200,
  rotationDeg: 0,
  title: "",
  camera: filmType === "フィルム" ? "PENTAX 67" : "SONY ILCE-1",
  filmType,
  shotAt,
  sortOrder,
  isPublished: true,
  seriesId: 4,
});

// 並び順（sortOrder）と id の順をわざとずらす。番号は並び順から出る。
const PHOTOS = [
  photo(30, "デジタル", 2, "2024-08-06T12:00:00"),
  photo(10, "フィルム", 0, "2026-03-11T00:00:00"),
  photo(20, "フィルム", 1, "2026-03-12T00:00:00"),
  photo(40, "デジタル", 3, "2026-08-11T12:00:00"),
];

function seedApi(settings: Record<string, string>) {
  canned["/api/settings"] = { seriesSortOrder: "manual", ...settings };
  canned["/api/series"] = {
    series: [{ id: 4, slug: "sea", title: "海の記憶", kind: "series", coverPhotoId: null }],
  };
  canned["/api/series?kind=work"] = { series: [] };
  canned["/api/series/sea"] = {
    series: { id: 4, slug: "sea", title: "海の記憶", subtitle: "", statement: "", themeConfig: null, kind: "series" },
    photos: PHOTOS,
  };
}

async function mountAt(path: string, route: string, page: React.ComponentType) {
  dom.window.history.pushState({}, "", path);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        Router,
        null,
        createElement(Route, { path: route }, createElement(page, null)) as never,
      ),
    ),
  );
  await flush(200);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  delete canned["/api/series/sea"];
  delete canned["/api/series?kind=work"];
  canned["/api/series"] = { series: [] };
  canned["/api/settings"] = {};
});

describe("写真集の骨格の計算", () => {
  test("媒体の帯は写真1枚ずつの記録どおりに切れる", () => {
    const runs = mediumRuns([
      { filmType: "フィルム" },
      { filmType: "フィルム" },
      { filmType: "デジタル" },
      { filmType: null },
      { filmType: "フィルム" },
    ]);
    expect(runs.map((r) => [r.medium, r.start, r.photos.length])).toEqual([
      ["film", 0, 2],
      ["digital", 2, 1],
      ["unknown", 3, 1],
      ["film", 4, 1],
    ]);
  });

  test("期間はデジタルの撮影日だけから組む", () => {
    const f = bookFacts(PHOTOS);
    expect(f.film).toBe(2);
    expect(f.digital).toBe(2);
    expect(f.digitalPeriod).toBe("2024.8–2026.8");
    expect(bookFacts([PHOTOS[1]!]).digitalPeriod).toBeNull();
  });

  test("番地と設定値の読み方", () => {
    expect(pageIndexFromHash("#p-07")).toBe(6);
    expect(pageIndexFromHash("#p-00")).toBeNull();
    expect(pageIndexFromHash("#sheet-sea")).toBeNull();
    expect(siteDesignFrom("book")).toBe("book");
    expect(siteDesignFrom("anything")).toBe("classic");
    expect(siteDesignFrom(undefined)).toBe("classic");
  });
});

describe("トップの扉の写真", () => {
  const p = (id: number) => ({ id, url: `/p${id}.jpg`, title: "" });
  const chapter = (photos: { id: number }[], coverPhotoId: number | null = null) =>
    ({ photos, coverPhotoId }) as never;
  const chapters = [chapter([p(1), p(2), p(3)]), chapter([p(7), p(8)], 8)];

  test("選んだ写真があればそれ", () => {
    expect(titlePhoto(chapters, [p(1)] as never, "3")?.id).toBe(3);
  });
  test("自動では、作品の扉と同じ写真（HERO が1枚目と同じなど）を避ける", () => {
    expect(titlePhoto(chapters, [p(1)] as never, "")?.id).toBe(2);
    expect(titlePhoto(chapters, [p(8), p(3)] as never, "")?.id).toBe(3);
  });
  test("選んだ写真が公開されていなければ自動へ戻る", () => {
    expect(titlePhoto(chapters, [] as never, "999")?.id).toBe(2);
  });
});

describe("目次（ベタ焼き）", () => {
  test("フィルムは帯に、デジタルは紙の上に。番号は作品の並び順", async () => {
    seedApi({ siteDesign: "book" });
    const m = await mountAt("/series", "/series", SeriesListPage);
    try {
      const runs = Array.from(m.host.querySelectorAll(".book-run"));
      expect(runs.map((r) => r.getAttribute("data-medium"))).toEqual([
        "film",
        "digital",
      ]);
      const hrefs = (run: Element) =>
        Array.from(run.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      // sortOrder 0,1 がフィルム（id 10, 20）、2,3 がデジタル（id 30, 40）
      expect(hrefs(runs[0]!)).toEqual(["/series/sea#p-01", "/series/sea#p-02"]);
      expect(hrefs(runs[1]!)).toEqual(["/series/sea#p-03", "/series/sea#p-04"]);
      expect(runs[0]!.querySelector("img")?.getAttribute("src")).toBe(
        "/api/images/thumbs/p10.webp",
      );
      expect(runs[1]!.querySelector("img")?.getAttribute("src")).toBe(
        "/api/images/thumbs/p30.webp",
      );
    } finally {
      m.cleanup();
    }
  });

  test("設定が無ければ今までの一覧のまま", async () => {
    seedApi({});
    const m = await mountAt("/series", "/series", SeriesListPage);
    try {
      expect(m.host.querySelector(".book")).toBeNull();
    } finally {
      m.cleanup();
    }
  });
});

describe("作品ページの頁", () => {
  test("扉が1枚目の頁になり、以降の頁に同じ番地が付く", async () => {
    seedApi({ siteDesign: "book" });
    const m = await mountAt("/series/sea", "/series/:slug", SeriesDetailPage);
    try {
      const pages = Array.from(m.host.querySelectorAll("[data-book-page]"));
      expect(pages.map((p) => p.id)).toEqual(["p-01", "p-02", "p-03", "p-04"]);
      expect(pages.map((p) => p.getAttribute("data-book-num"))).toEqual([
        "01 / 04",
        "02 / 04",
        "03 / 04",
        "04 / 04",
      ]);
      // 頁の写真は並び順どおり（p-02 は sortOrder 1 = id 20）
      expect(
        m.host.querySelector("#p-02 [data-photo-tile]")?.getAttribute("data-photo-tile"),
      ).toBe("20");
      expect(m.host.querySelectorAll("h1").length).toBe(1);
    } finally {
      m.cleanup();
    }
  });
});
