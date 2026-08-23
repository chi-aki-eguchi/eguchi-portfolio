/**
 * 一覧の札に出る「規模と時期」。
 *
 * 表紙2枚が並ぶだけでは、5点の組と59点の組を押す前に見分けられなかった。
 * API の集計（`photoCount` / `shotAtFirst` / `shotAtLast`）を札へ出す。
 *
 * **分からないときは行ごと出さない。** 空の行は事実ではなく作りかけに見える。
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

async function mount(extra: Record<string, unknown>) {
  canned["/api/series"] = {
    series: [
      {
        id: 1,
        slug: "sea",
        title: "海の記憶",
        subtitle: null,
        coverUrl: "https://example.test/c.jpg",
        ...extra,
      },
    ],
  };
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
  return {
    text: host.textContent ?? "",
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/series"] = { series: [] };
});

describe("一覧の札の規模と時期", () => {
  test("枚数と期間が揃えば両方出す", async () => {
    const m = await mount({
      photoCount: 59,
      shotAtFirst: "2024-08-19T13:47:04",
      shotAtLast: "2025-08-02T09:00:00",
    });
    try {
      expect(m.text).toContain("59点 ／ 2024年8月–2025年8月");
    } finally {
      m.cleanup();
    }
  });

  test("撮影日が無ければ枚数だけ出す", async () => {
    const m = await mount({ photoCount: 7, shotAtFirst: null, shotAtLast: null });
    try {
      expect(m.text).toContain("7点");
      expect(m.text).not.toContain("／");
    } finally {
      m.cleanup();
    }
  });

  test("集計が無い応答（古いクライアント/空のシリーズ）では行ごと出さない", async () => {
    for (const extra of [{}, { photoCount: 0 }]) {
      const m = await mount(extra);
      try {
        expect(`${JSON.stringify(extra)}: ${m.text.includes("点")}`).toBe(
          `${JSON.stringify(extra)}: false`,
        );
      } finally {
        m.cleanup();
      }
    }
  });
});
