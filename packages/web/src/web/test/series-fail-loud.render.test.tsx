/**
 * シリーズ一覧の「取れなかった」と「まだ無い」を混同しない回帰テスト。
 *
 * 2026-08-11 実測: `/api/series` を 500 にすると、/series は
 * **「まだシリーズがありません」**と表示していた。訪問者から見ると、この写真家に
 * 作品が無いようにしか見えない。Gallery 側は既に同じ罠（fail-quiet trap）を
 * 避けていたが、シリーズ側だけ残っていた。
 *
 * 取れなかったときは、そう言って再読み込みを出す。
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

async function mountGrid() {
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
  await flush(160);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/series"] = { series: [] };
  canned["/api/settings"] = {};
});

describe("シリーズ一覧の取得失敗", () => {
  test("取れなかったときに「まだシリーズがありません」と言わない", async () => {
    // canned から消すと 404 が返り、jsonOrThrow が投げる
    delete canned["/api/series"];
    const m = await mountGrid();
    try {
      const text = m.host.textContent ?? "";
      expect(text, "空扱いになっている").not.toContain("まだシリーズがありません");
      // 再読み込みの導線が要る
      expect(m.host.querySelector("button"), "再読み込みが要る").not.toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("本当に0件のときは、今までどおり「まだシリーズがありません」", async () => {
    canned["/api/series"] = { series: [] };
    const m = await mountGrid();
    try {
      expect(m.host.textContent).toContain("まだシリーズがありません");
    } finally {
      m.cleanup();
    }
  });
});
