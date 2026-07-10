/**
 * Render test: Library の並び替えロック警告に「並び替えできる状態に戻す」
 * 復帰ボタンが表示され、押すと librarySort が manual に戻り警告が消えること。
 * fetch は全モックで、本物のDBには一切書き込まない
 * (先輩側「並び替えできない」サポート 2026-07-11 の回帰テスト)。
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  {
    url: "http://localhost/",
    pretendToBeVisual: true,
  },
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

const samplePhotos = [
  {
    id: 1,
    url: "/api/images/photos/a.jpg",
    title: "a",
    meta: "",
    description: "",
    category: "works",
    filename: "a.jpg",
    isPublished: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    url: "/api/images/photos/b.jpg",
    title: "b",
    meta: "",
    description: "",
    category: "works",
    filename: "b.jpg",
    isPublished: true,
    sortOrder: 1,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

globalThis.fetch = (async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  if (method !== "GET") return json({ ok: true });
  if (url.includes("/api/admin/photos")) return json({ photos: samplePhotos });
  if (url.includes("/api/photos")) return json({ photos: samplePhotos });
  if (url.includes("/api/admin/setup-health"))
    return json({ storageConfigured: true, missingStorageVariables: [] });
  if (url.includes("/api/categories")) return json({ categories: [] });
  if (url.includes("/api/series")) return json({ series: [] });
  if (url.includes("/api/admin/hero-photos")) return json({ heroPhotos: [] });
  if (url.includes("/api/admin/albums")) return json({ albums: [] });
  if (url.includes("/api/settings")) return json({});
  return json({});
}) as typeof fetch;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");
const { GalleryTab } = await import("./admin");

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
};

test("並び替えロック中は復帰ボタンが出て、押すと手動順に戻り警告が消える", async () => {
  // ブラウザ別 sessionStorage に非manualソートが残っている状態を再現
  // (先輩側で並び替え不能に見えた第一候補の状態)。値はサニタイズ effect の
  // 正規リストにある "createdAt-desc" を使う(不正値は "manual" に戻される)。
  window.sessionStorage.setItem(
    "admin:librarySort",
    JSON.stringify("createdAt-desc"),
  );

  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const host = document.getElementById("root")!;
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(GalleryTab, {}),
      ),
    );
  });
  await flush();
  await flush();

  // ロック警告と復帰ボタン(文言固定)
  expect(host.textContent).toContain("いまは並び替えを保存できません");
  const buttons = Array.from(host.querySelectorAll("button"));
  const restore = buttons.find((b) =>
    (b.textContent ?? "").includes("並び替えできる状態に戻す"),
  );
  expect(restore).toBeDefined();

  // タッチ端末向けの操作案内も表示される
  expect(host.textContent).toContain("ドラッグ");
  expect(host.textContent).toContain("矢印ボタン");

  // 押すと librarySort=manual に戻り、警告ごと消える
  await act(async () => {
    restore!.dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
  });
  await flush();

  expect(window.sessionStorage.getItem("admin:librarySort")).toBe(
    JSON.stringify("manual"),
  );
  expect(host.textContent).not.toContain("いまは並び替えを保存できません");

  await act(async () => {
    root.unmount();
  });
});
