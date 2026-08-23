/**
 * 列は「中身の数」を超えない。
 *
 * 2026-08-23 に 1440px で実測: シリーズが2件なのに `repeat(3, 1fr)` を敷いて
 * いたため、一覧が画面の3分の2で止まり、右3分の1が丸ごと空いていた。
 * `admin-renewal-goal.md` の到達点 #5「1440pxで本文が画面の3割しか使って
 * いない画面が無い」が禁じている形そのもの。
 *
 * 秋さんのサイトは写真が数百枚あるので Gallery 側では出ないが、Portfolio Kit
 * は空に近い状態から始まり、絞り込みの結果が2件になることもある。
 * `site-and-data-direction.md` §0 が「0件のときに何が見えるか」を先に決めろと
 * 言っているのと同じ話で、少数のときに「隅に小さな札が数枚」になってはいけない。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router } = await import("wouter");
const { SeriesGrid } = await import("../components/SeriesGrid");

const doc = dom.window.document;

const seriesOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    slug: `s${i + 1}`,
    title: `作品群 ${i + 1}`,
    subtitle: null,
    coverUrl: `https://example.test/c${i + 1}.jpg`,
  }));

async function mount(count: number, columns = "3") {
  canned["/api/settings"] = { seriesGridColumns: columns };
  canned["/api/series"] = { series: seriesOf(count) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Router, null, createElement(SeriesGrid, null) as never),
    ),
  );
  await flush(140);
  const grid = host.querySelector<HTMLElement>('[style*="grid-template-columns"]');
  return {
    host,
    tracks: grid?.style.gridTemplateColumns ?? "",
    maxWidth: grid?.style.maxWidth ?? "",
    marginInline: grid?.style.marginInline ?? "",
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
  canned["/api/series"] = { series: [] };
});

describe("シリーズ一覧の列は中身の数を超えない", () => {
  test("3列設定でも2件なら2列。右端が空かない", async () => {
    const m = await mount(2);
    try {
      expect(m.tracks).toBe("repeat(2, minmax(0, 1fr))");
    } finally {
      m.cleanup();
    }
  });

  test("件数が列数以上なら設定どおりの列数を使う", async () => {
    for (const count of [3, 5]) {
      const m = await mount(count);
      try {
        expect(`${count}件: ${m.tracks}`).toBe(
          `${count}件: repeat(3, minmax(0, 1fr))`,
        );
      } finally {
        m.cleanup();
      }
    }
  });

  test("1件は1列だが、幅を抑えて中央に置く（全幅の板にしない）", async () => {
    const m = await mount(1);
    try {
      expect(m.tracks).toBe("repeat(1, minmax(0, 1fr))");
      expect(m.maxWidth).not.toBe("");
      expect(m.marginInline).toBe("auto");
    } finally {
      m.cleanup();
    }
  });

  test("もともと1列設定なら、1件でも幅を絞らない", async () => {
    const m = await mount(1, "1");
    try {
      expect(m.tracks).toBe("repeat(1, minmax(0, 1fr))");
      expect(m.maxWidth).toBe("");
    } finally {
      m.cleanup();
    }
  });
});
