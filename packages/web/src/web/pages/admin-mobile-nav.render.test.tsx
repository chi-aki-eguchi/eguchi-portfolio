/**
 * Render test: スマホ admin ナビ(下部3グループバー+ボトムシート)。
 * 2026-07-11 モバイル操作性改善の回帰ガード:
 * - 3グループが下部バーに常時表示される(旧・横スクロールでactiveタブが
 *   画面外へ流れる問題の再発防止)
 * - グループタップでシートが開き、タブ選択で onSelectTab が呼ばれて閉じる
 * - setup(はじめに)もサイトグループのシートから到達できる
 * - アップロード中は gallery を含まないグループが無効化される
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { url: "http://localhost/", pretendToBeVisual: true },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage,
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AdminMobileTabBar } = await import("./admin-mobile-nav");
const { ADMIN_TAB_GROUPS } = await import("./admin-shared");
type Tab = import("./admin-shared").Tab;

const TAB_META = Object.fromEntries(
  ADMIN_TAB_GROUPS.flatMap((g) =>
    g.tabs.map((t) => [t, { label: `label-${t}`, icon: null }]),
  ),
) as Record<Tab, { label: string; icon: null }>;

const click = (el: Element) =>
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

function findButton(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text),
  );
}

test("下部バー: 3グループ表示 → シートからタブ選択、setupにも到達できる", async () => {
  const selected: Tab[] = [];
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  const render = async (tab: Tab, galleryUploading = false) => {
    await act(async () => {
      root.render(
        createElement(AdminMobileTabBar, {
          tab,
          tabMeta: TAB_META,
          galleryUploading,
          onSelectTab: (t: Tab) => {
            selected.push(t);
            return true;
          },
        }),
      );
    });
  };

  await render("gallery");

  // 3グループが常時見える(横スクロールに依存しない)
  for (const g of ADMIN_TAB_GROUPS) {
    expect(findButton(host, g.label)).toBeDefined();
  }
  // active グループには現在タブ名が添えられる
  expect(host.textContent).toContain("label-gallery");

  // 複数タブのグループ → シートが開く
  await act(async () => {
    click(findButton(host, "見せ方")!);
  });
  const sheet = host.querySelector(".admin-sheet");
  expect(sheet).not.toBeNull();
  for (const t of ["hero", "series", "categories"]) {
    expect(sheet!.textContent).toContain(`label-${t}`);
  }

  // シートからタブ選択 → onSelectTab が呼ばれ、シートは閉じる
  await act(async () => {
    click(findButton(host, "label-series")!);
  });
  expect(selected).toEqual(["series"]);
  expect(host.querySelector(".admin-sheet")).toBeNull();

  // サイトグループのシートには setup(はじめに)も並ぶ
  await render("series");
  await act(async () => {
    click(findButton(host, "サイト")!);
  });
  expect(host.querySelector(".admin-sheet")!.textContent).toContain(
    "label-setup",
  );
  // active タブはシート上で data-active になる
  await act(async () => {
    click(findButton(host, "label-setup")!);
  });
  await render("setup");
  await act(async () => {
    click(findButton(host, "サイト")!);
  });
  const activeRow = host.querySelector('.admin-sheet__row[data-active="true"]');
  expect(activeRow?.textContent).toContain("label-setup");
  await act(async () => {
    click(host.querySelector(".admin-sheet__backdrop")!);
  });
  expect(host.querySelector(".admin-sheet")).toBeNull();

  // 単一タブのグループ(写真)は直接切替
  selected.length = 0;
  await act(async () => {
    click(findButton(host, "写真")!);
  });
  expect(selected).toEqual(["gallery"]);

  // アップロード中: gallery を含まないグループは無効
  await render("gallery", true);
  expect((findButton(host, "見せ方") as HTMLButtonElement).disabled).toBe(true);
  expect((findButton(host, "写真") as HTMLButtonElement).disabled).toBe(false);

  await act(async () => {
    root.unmount();
  });
});
