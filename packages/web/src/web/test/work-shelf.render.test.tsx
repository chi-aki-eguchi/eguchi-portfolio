/**
 * Work の棚（2026-08-30 オーナー依頼「work はシリーズみたいな感じで自分で
 * 他に入れれる仕組み」）。
 *
 * **別テーブルを作らず、`series` に `kind` を足して棚を2つにした。**
 * だから壊れ方も「棚が混ざる」形で出る——Work の一覧にシリーズが出る、
 * Work の詳細から次へ進むとシリーズへ飛ぶ、ナビに空の棚が出る、など。
 * ここではその混ざりを見張る。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const SeriesListPage = (await import("../pages/series")).default;

const doc = dom.window.document;

const SERIES = [
  { id: 1, slug: "ishigaki", title: "Ishigaki Island", subtitle: "", coverUrl: "/api/images/a.jpg", photoCount: 59 },
];
const WORKS = [
  { id: 2, slug: "kyoto-hotel", title: "京都のホテル", subtitle: "2025", coverUrl: "/api/images/b.jpg", photoCount: 12 },
];

async function mount(node: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(QueryClientProvider, { client: qc }, node as never));
  await flush(160);
  return { host, cleanup: () => { root.unmount(); host.remove(); } };
}

afterEach(() => {
  canned["/api/series"] = { series: [] };
  delete canned["/api/series?kind=work"];
  canned["/api/settings"] = {};
});

describe("Work の棚", () => {
  test("Work の一覧には Work だけが出て、押した先も /work", async () => {
    canned["/api/series"] = { series: SERIES };
    canned["/api/series?kind=work"] = { series: WORKS };
    const m = await mount(createElement(SeriesListPage, { kind: "work" }));
    try {
      const text = m.host.textContent ?? "";
      expect(text).toContain("京都のホテル");
      expect(text).not.toContain("Ishigaki Island");
      const hrefs = [...m.host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
      expect(hrefs).toContain("/work/kyoto-hotel");
      expect(hrefs.some((h) => h?.startsWith("/series/"))).toBe(false);
    } finally {
      m.cleanup();
    }
  });

  test("シリーズの一覧はこれまでどおり（Work が混ざらない）", async () => {
    canned["/api/series"] = { series: SERIES };
    canned["/api/series?kind=work"] = { series: WORKS };
    const m = await mount(createElement(SeriesListPage, {}));
    try {
      const text = m.host.textContent ?? "";
      expect(text).toContain("Ishigaki Island");
      expect(text).not.toContain("京都のホテル");
    } finally {
      m.cleanup();
    }
  });

  test("棚の名前は設定で変えられる", async () => {
    canned["/api/series?kind=work"] = { series: WORKS };
    canned["/api/settings"] = { navLabelWork: "Commissions" };
    const m = await mount(createElement(SeriesListPage, { kind: "work" }));
    try {
      expect(m.host.textContent ?? "").toContain("Commissions");
    } finally {
      m.cleanup();
    }
  });
});
