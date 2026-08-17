/**
 * 読み込み中でも、タブの見出しは消えない。
 *
 * 実測（2026-08-17 / 768〜1920px の6段階）: Hero へ切り替えた直後だけ
 * `.admin-page-header__title` が取得できず、他8タブは取得できた。原因は
 * HeroTab が読み込み中に「中央のスピナーだけ」を返しており、見出しごと
 * 画面から消えていたこと。到達点(1)「タブを切り替えても内容が横に飛ばない」は
 * 読み込みが終わったあとだけの話ではない。
 *
 * スモークの `admin-page-frame.spec.ts` はこれを捕まえられない。Playwright の
 * `toHaveCount` は条件が満たされるまで待つので、遅れて出る見出しでも通る。
 * ここでは「データが返る前の一瞬」を止めて見る。
 */
import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
Object.defineProperty(dom.window, "matchMedia", {
  configurable: true,
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// 応答を返さない fetch。読み込み中の状態のまま描画を観察する。
globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { AdminLanguageProvider } = await import("./admin-i18n");
const { HeroTab, SeriesTab, CategoriesTab } = await import("./admin-tabs");

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

async function renderTab(Tab: () => unknown) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AdminLanguageProvider,
          null,
          createElement(Tab as never),
        ),
      ),
    );
  });
  await flush();
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
      qc.clear();
    },
  };
}

for (const [name, Tab] of [
  ["Hero", HeroTab],
  ["Series", SeriesTab],
  ["Categories", CategoriesTab],
] as const) {
  test(`${name} — 読み込み中でも見出しが出ている`, async () => {
    const { container, cleanup } = await renderTab(Tab as () => unknown);
    const title = container.querySelector("h1.admin-page-header__title");
    expect(
      title,
      `${name} は読み込み中に見出しごと消えている`,
    ).not.toBeNull();
    expect(title?.textContent?.trim()).toBeTruthy();
    await cleanup();
  });
}
