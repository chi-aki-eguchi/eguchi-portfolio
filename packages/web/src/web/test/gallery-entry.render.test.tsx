/**
 * Gallery の入口。
 *
 * `galleryExcludeSeries` が `on` のサイトの Gallery は、どこの組にも属さない
 * 写真だけを並べる（2026-08-09 オーナー依頼）。その写真が1枚も無いあいだ、
 * 共通ナビの Gallery は押した先が空で行き止まる——2026-09-16 の本番が実際に
 * その状態で、公開写真133枚は全部 Series / Work に入っていた。
 *
 * ここで縛るのは3点。
 *  1. 並べる写真があるときは、これまでどおり入口も一覧も出る
 *  2. 1枚も無いときは共通ナビから入口を外し、**URLで来た人は行き止まりにしない**
 *     （中身のある棚へ送る。押しても何も起きない絞り込みの行も出さない）
 *  3. 件数が分からない（取得に失敗した）ときは入口を消さない
 *
 * 写真は固定の検証データ。本番の写真・設定には依存しない。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush, samplePhotos } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Provider } = await import("../components/provider");
const Layout = (await import("../components/Layout")).default;
const GalleryPage = (await import("../pages/gallery")).default;

const doc = dom.window.document;

const photo = (id: number, seriesId: number | null) => ({
  id,
  filename: `p${id}.jpg`,
  url: `/api/images/photos/p${id}.jpg`,
  title: `写真${id}`,
  meta: "",
  camera: null,
  lens: null,
  filmType: null,
  shotAt: "2026-03-01T10:00:00",
  description: "",
  category: "life",
  displaySize: "M",
  isPublished: true,
  seriesId,
  width: 3200,
  height: 2133,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
});
const SERIES = [
  { id: 9, slug: "sea", title: "海の記憶", subtitle: "", coverUrl: "/api/images/photos/p1.jpg", photoCount: 2 },
];
const WORKS = [
  { id: 10, slug: "rintaro", title: "Rintaro Otsuka", subtitle: "", coverUrl: "/api/images/photos/p2.jpg", photoCount: 1 },
];

/** 組に入れた写真だけのサイト（＝Gallery に並べる写真が無い）。 */
function seedShelvesOnly() {
  canned["/api/settings"] = { galleryExcludeSeries: "on" };
  canned["/api/photos"] = { photos: [photo(1, 9), photo(2, 9), photo(3, 10)] };
  canned["/api/photos/availability"] = { total: 3, standalone: 0 };
  canned["/api/series"] = { series: SERIES };
  canned["/api/series?kind=work"] = { series: WORKS };
}

/** 単発の写真もあるサイト。 */
function seedStandalonePhotos() {
  canned["/api/settings"] = { galleryExcludeSeries: "on" };
  canned["/api/photos"] = { photos: [photo(1, 9), photo(2, null), photo(3, null)] };
  canned["/api/photos/availability"] = { total: 3, standalone: 2 };
  canned["/api/series"] = { series: SERIES };
  canned["/api/series?kind=work"] = { series: WORKS };
}

async function mount(node: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(QueryClientProvider, { client: qc }, node as never));
  await flush(220);
  return { host, cleanup: () => { root.unmount(); host.remove(); } };
}

const mountNav = () =>
  mount(createElement(Provider, null, createElement(Layout, null, createElement("p", null, "page"))));

// **共有の既定値へ戻す。** `canned` はテストファイル間で1つなので、
// ここで空にすると、あとから走るファイルが写真0枚の世界を見る
// （実測 2026-09-16: 空に戻して28件が巻き添えで落ちた）。
afterEach(() => {
  canned["/api/settings"] = {};
  canned["/api/photos"] = { photos: samplePhotos };
  canned["/api/photos/availability"] = { total: 3, standalone: 2 };
  canned["/api/series"] = { series: [] };
  delete canned["/api/series?kind=work"];
});

describe("Gallery の入口", () => {
  test("単発の写真があれば、入口も一覧もこれまでどおり", async () => {
    seedStandalonePhotos();
    const nav = await mountNav();
    try {
      expect(nav.host.querySelector('a[href="/gallery"]')).not.toBeNull();
    } finally {
      nav.cleanup();
    }
    const page = await mount(createElement(GalleryPage));
    try {
      expect(page.host.querySelectorAll("[data-photo-tile]").length).toBe(2);
      expect(page.host.querySelector('nav[aria-label="写真のある場所"]')).toBeNull();
      expect(page.host.textContent).not.toContain("まだ写真がありません");
    } finally {
      page.cleanup();
    }
  });

  test("並べる写真が無ければ、共通ナビから入口を外す", async () => {
    seedShelvesOnly();
    const nav = await mountNav();
    try {
      expect(nav.host.querySelector('a[href="/gallery"]')).toBeNull();
      // 棚は残る。写真はそちらにある。
      expect(nav.host.querySelector('a[href="/series"]')).not.toBeNull();
      expect(nav.host.querySelector('a[href="/work"]')).not.toBeNull();
    } finally {
      nav.cleanup();
    }
  });

  test("URLで来た人は行き止まりにせず、中身のある棚へ送る", async () => {
    seedShelvesOnly();
    const m = await mount(createElement(GalleryPage));
    try {
      expect(m.host.querySelectorAll("[data-photo-tile]").length).toBe(0);
      const guide = m.host.querySelector('nav[aria-label="写真のある場所"]');
      expect(guide).not.toBeNull();
      const hrefs = [...guide!.querySelectorAll("a")].map((a) => a.getAttribute("href"));
      expect(hrefs).toEqual(["/series", "/work"]);
      expect(guide!.textContent).toContain("海の記憶");
      expect(guide!.textContent).toContain("Rintaro Otsuka");
      // 押しても何も変わらない絞り込みは出さない。
      expect(m.host.querySelector(".gallery-filter-row")).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("棚も空なら、これまでどおり「まだ写真がありません」", async () => {
    canned["/api/settings"] = { galleryExcludeSeries: "on" };
    canned["/api/photos"] = { photos: [] };
    canned["/api/photos/availability"] = { total: 0, standalone: 0 };
    const m = await mount(createElement(GalleryPage));
    try {
      expect(m.host.textContent).toContain("まだ写真がありません");
      expect(m.host.querySelector('nav[aria-label="写真のある場所"]')).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("件数が取れないときは入口を消さない", async () => {
    seedShelvesOnly();
    delete canned["/api/photos/availability"]; // 404 → 取得失敗
    const nav = await mountNav();
    try {
      expect(nav.host.querySelector('a[href="/gallery"]')).not.toBeNull();
    } finally {
      nav.cleanup();
      canned["/api/photos/availability"] = { total: 3, standalone: 2 };
    }
  });
});
