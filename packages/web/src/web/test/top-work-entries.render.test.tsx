/**
 * TOP から作品へ進む導線。
 *
 * TOP には表示方式が5つあり、どれにも「作品を見る」リンクが2か所（見出しの
 * 横と、写真のあとの導線）置かれている。**片方の表示方式だけ直すと、選んで
 * いる方式によって行き先が変わる。**ここでは5方式すべてを同じ規則で見張る。
 *
 * 規則そのもの（数え方・重複の省き方）は `lib/work-entries.test.ts`。
 * ここは「その規則が全部の表示方式に届いているか」だけを見る。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush, samplePhotos } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const TopPage = (await import("../pages/top")).default;

const doc = dom.window.document;
const HERO_MODES = ["carousel", "single", "quiet-grid", "editorial", "immersive"];

const SERIES = [
  { id: 9, slug: "sea", title: "海の記憶", subtitle: "", coverUrl: "/api/images/photos/a.jpg", photoCount: 4 },
];
const WORKS = [
  { id: 10, slug: "rintaro", title: "Rintaro Otsuka", subtitle: "", coverUrl: "/api/images/photos/b.jpg", photoCount: 3 },
];

async function mountTop(settings: Record<string, string>) {
  canned["/api/settings"] = settings;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(QueryClientProvider, { client: qc }, createElement(TopPage) as never));
  await flush(220);
  const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  return {
    host,
    text: host.textContent ?? "",
    hrefs,
    cleanup: () => { root.unmount(); host.remove(); },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
  canned["/api/photos"] = { photos: samplePhotos };
  canned["/api/photos/availability"] = { total: 3, standalone: 2 };
  canned["/api/series"] = { series: [] };
  delete canned["/api/series?kind=work"];
});

describe("TOP から作品へ進む導線", () => {
  for (const heroMode of HERO_MODES) {
    test(`heroMode=${heroMode}: Gallery に写真があれば Gallery のまま`, async () => {
      canned["/api/photos/availability"] = { total: 3, standalone: 2 };
      canned["/api/series"] = { series: SERIES };
      canned["/api/series?kind=work"] = { series: WORKS };
      const m = await mountTop({
        heroMode,
        galleryExcludeSeries: "on",
        viewAllCtaLabel: "すべての作品を見る",
      });
      try {
        expect(m.hrefs).toContain("/gallery");
        expect(m.text).toContain("すべての作品を見る");
      } finally {
        m.cleanup();
      }
    });

    test(`heroMode=${heroMode}: Gallery が0枚なら、中身のある棚へ送る`, async () => {
      canned["/api/photos"] = { photos: samplePhotos.map((p) => ({ ...p, seriesId: 9 })) };
      canned["/api/photos/availability"] = { total: 3, standalone: 0 };
      canned["/api/series"] = { series: SERIES };
      canned["/api/series?kind=work"] = { series: WORKS };
      const m = await mountTop({
        heroMode,
        galleryExcludeSeries: "on",
        // 帯を出さない設定にして、シリーズの入口が省かれない状態で見る。
        topSeriesStream: "off",
        viewAllCtaLabel: "すべての作品を見る",
      });
      try {
        expect(m.hrefs).not.toContain("/gallery");
        expect(m.hrefs).toContain("/series");
        expect(m.hrefs).toContain("/work");
        expect(m.text).toContain("シリーズを見る");
        expect(m.text).toContain("Workを見る");
        expect(m.text).not.toContain("すべての作品を見る");
      } finally {
        m.cleanup();
      }
    });
  }

  test("帯でシリーズを流している TOP では、シリーズの入口を重ねない", async () => {
    canned["/api/photos"] = { photos: samplePhotos.map((p) => ({ ...p, seriesId: 9 })) };
    canned["/api/photos/availability"] = { total: 3, standalone: 0 };
    canned["/api/series"] = { series: SERIES };
    canned["/api/series?kind=work"] = { series: WORKS };
    const m = await mountTop({ heroMode: "single", galleryExcludeSeries: "on", topSeriesStream: "after-works" });
    try {
      expect(m.hrefs).toContain("/work");
      expect(m.text).not.toContain("シリーズを見る");
    } finally {
      m.cleanup();
    }
  });

  test("見に行ける作品がどこにも無ければ、作品閲覧の導線は出さない", async () => {
    canned["/api/photos"] = { photos: samplePhotos.map((p) => ({ ...p, seriesId: 9 })) };
    canned["/api/photos/availability"] = { total: 3, standalone: 0 };
    canned["/api/series"] = { series: [] };
    canned["/api/series?kind=work"] = { series: [] };
    const m = await mountTop({ heroMode: "single", galleryExcludeSeries: "on", viewAllCtaLabel: "すべての作品を見る" });
    try {
      expect(m.hrefs).not.toContain("/gallery");
      expect(m.hrefs).not.toContain("/series");
      expect(m.hrefs).not.toContain("/work");
      expect(m.text).not.toContain("すべての作品を見る");
    } finally {
      m.cleanup();
    }
  });

  test("件数が取れないときは Gallery のまま（0枚として扱わない）", async () => {
    delete canned["/api/photos/availability"];
    canned["/api/series"] = { series: SERIES };
    canned["/api/series?kind=work"] = { series: WORKS };
    const m = await mountTop({ heroMode: "single", galleryExcludeSeries: "on", viewAllCtaLabel: "すべての作品を見る" });
    try {
      expect(m.hrefs).toContain("/gallery");
      expect(m.text).toContain("すべての作品を見る");
    } finally {
      m.cleanup();
      canned["/api/photos/availability"] = { total: 3, standalone: 2 };
    }
  });
});
