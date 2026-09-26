/**
 * 写真中心のサイト（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * ここで縛るのは、見た目ではなく**事実と行き先**:
 *  1. トップは「トップに載せる写真」を先頭に、ほかの写真を全部（重ねない）
 *  2. シリーズの一覧の札は、そのシリーズに入っている写真だけ（1枚が複数の
 *     シリーズに入れる）。表紙が先頭
 *  3. シリーズのページは、そのシリーズの並び順どおりに写真を置く
 *  4. 期間はデジタルの撮影日だけから組む（フィルムの shotAt は複写日時）
 *  5. 設定が無いサイト（配布版の既定）は今までの骨格のまま
 */
import { test, expect, describe, afterEach, beforeAll, afterAll } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";
import { bookFacts, galleryExcludesSeries, siteDesignFrom } from "../lib/book";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router, Route } = await import("wouter");
const SeriesListPage = (await import("../pages/series")).default;
const SeriesDetailPage = (await import("../pages/series-detail")).default;
const { leadOrdered } = await import("../components/photo-site/PhotoHome");
const { stripFor } = await import("../components/photo-site/PhotoSeries");

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
  seriesIds: [4],
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

describe("計算", () => {
  test("期間はデジタルの撮影日だけから組む", () => {
    const f = bookFacts(PHOTOS);
    expect(f.film).toBe(2);
    expect(f.digital).toBe(2);
    expect(f.digitalPeriod).toBe("2024.8–2026.8");
    expect(bookFacts([PHOTOS[1]!]).digitalPeriod).toBeNull();
  });

  test("設定値の読み方", () => {
    expect(siteDesignFrom("book")).toBe("book");
    expect(siteDesignFrom("anything")).toBe("classic");
    expect(siteDesignFrom(undefined)).toBe("classic");
  });

  test("写真中心のサイトでは、作品の写真を外す設定に関わらず、すべての写真", () => {
    expect(galleryExcludesSeries({ siteDesign: "book", galleryExcludeSeries: "on" })).toBe(false);
    expect(galleryExcludesSeries({ siteDesign: "classic", galleryExcludeSeries: "on" })).toBe(true);
    expect(galleryExcludesSeries({ galleryExcludeSeries: "off" })).toBe(false);
  });
});

describe("トップの並び", () => {
  const p = (id: number) => ({ id, url: `/p${id}.jpg`, title: "" });
  test("トップに載せる写真を先頭に、ほかを全部。重ねない。公開されていない写真は入れない", () => {
    const all = [p(1), p(2), p(3), p(4)];
    expect(leadOrdered(all as never, [p(3), p(9), p(1)] as never).map((x) => x.id)).toEqual([3, 1, 2, 4]);
    expect(leadOrdered(all as never, [] as never).map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });
});

describe("シリーズの札", () => {
  const p = (id: number, seriesIds: number[]) => ({ id, url: "", title: "", seriesIds });
  test("そのシリーズに入っている写真だけ、表紙を先頭に", () => {
    const photos = [p(1, [4]), p(2, [5]), p(3, [5, 4]), p(4, [4])];
    expect(stripFor({ id: 4, slug: "a", title: "A", coverPhotoId: 4 }, photos as never).map((x) => x.id)).toEqual([4, 1, 3]);
    expect(stripFor({ id: 5, slug: "b", title: "B" }, photos as never).map((x) => x.id)).toEqual([2, 3]);
  });
});

describe("シリーズの一覧", () => {
  test("題名で読む目次。行はシリーズのページへ開く", async () => {
    seedApi({ siteDesign: "book" });
    const previousPhotos = canned["/api/photos"];
    canned["/api/photos"] = { photos: PHOTOS };
    const m = await mountAt("/series", "/series", SeriesListPage);
    try {
      const links = Array.from(m.host.querySelectorAll(".ps-series-entry__link")).map((a) => a.getAttribute("href"));
      expect(links).toEqual(["/series/sea"]);
      expect(m.host.querySelector(".ps-series-entry__title")?.textContent).toBe("海の記憶");
      expect(m.host.querySelectorAll(".ps-series-entry__frame").length).toBe(4);
    } finally {
      m.cleanup();
      // 共通の見本（jsdom-setup）を消さずに戻す。消すと後のテストが空の一覧を読む。
      canned["/api/photos"] = previousPhotos;
    }
  });

  test("設定が無ければ今までの一覧のまま", async () => {
    seedApi({});
    const m = await mountAt("/series", "/series", SeriesListPage);
    try {
      expect(m.host.querySelector(".ps-page")).toBeNull();
    } finally {
      m.cleanup();
    }
  });
});

describe("シリーズのページ", () => {
  // jsdom には幅が無いので、段を組めるよう幅を与える。
  const proto = dom.window.HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, "clientWidth");
  beforeAll(() => {
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 1200 });
  });
  afterAll(() => {
    // 元は Element.prototype 側にある。ここに足したものを消して、後のテストへ残さない。
    if (original) Object.defineProperty(proto, "clientWidth", original);
    else delete (proto as unknown as Record<string, unknown>).clientWidth;
  });

  test("見出しは1つ。写真はシリーズの並び順どおりに置き、押すとビューアが開く", async () => {
    seedApi({ siteDesign: "book" });
    const m = await mountAt("/series/sea", "/series/:slug", SeriesDetailPage);
    try {
      expect(m.host.querySelectorAll("h1").length).toBe(1);
      expect(m.host.querySelector("h1")?.textContent).toBe("海の記憶");
      const tiles = Array.from(m.host.querySelectorAll("[data-photo-tile]")).map((b) => b.getAttribute("data-photo-tile"));
      // 並びは sortOrder（手動の並び）: 10, 20, 30, 40
      expect(tiles).toEqual(["10", "20", "30", "40"]);
      expect(m.host.querySelector(".ps-series-head__facts")?.textContent).toContain("4");
      (m.host.querySelector('[data-photo-tile="30"]') as HTMLButtonElement).click();
      await flush(50);
      expect(doc.querySelector("dialog[open], [role='dialog']")).not.toBeNull();
    } finally {
      m.cleanup();
    }
  });
});
