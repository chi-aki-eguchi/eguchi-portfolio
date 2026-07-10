/**
 * Render test: 「はじめに」(SetupTab)は表示しただけでは書き込みを一切せず、
 * 「セットアップ完了 → ライブラリへ」の明示操作でのみ setupCompleted=true を
 * POST してライブラリへ遷移することを、fetch全モックで検証する
 * (自動バックフィル削除 2026-07-10 の回帰テスト。本物のDBには触れない)。
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
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// fetch を丸ごとモックし、全リクエストを記録する。POST は成功を返すが
// どこにも書き込まれない(production相当DBへの書き込みゼロ)。
const requests: { method: string; url: string; body: string }[] = [];
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
  const body = init?.body ? String(init.body) : "";
  requests.push({ method, url, body });
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  if (url.includes("/api/admin/settings") && method === "POST")
    return json({ ok: true });
  if (url.includes("/api/admin/hero-photos")) return json({ heroPhotos: [] });
  if (url.includes("/api/admin/setup-health"))
    return json({ storageConfigured: true, missingStorageVariables: [] });
  if (url.includes("/api/settings")) return json({});
  if (url.includes("/api/photos")) return json({ photos: [] });
  if (url.includes("/api/categories")) return json({ categories: [] });
  return json({});
}) as typeof fetch;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");
const { SetupTab } = await import("./admin");

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

test("SetupTab — 表示しただけではPOSTを1回もしない / 完了ボタンで1回だけPOSTしライブラリへ", async () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const openedTabs: string[] = [];
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(SetupTab, {
          onOpenTab: (tab: string) => openedTabs.push(tab),
        }),
      ),
    );
  });
  // クエリ(GET)が全部返って画面が確定するまで待つ
  for (let i = 0; i < 10; i++) {
    await flush();
    if (container.textContent?.includes("セットアップ完了")) break;
  }

  // (2) 画面を開いただけでは書き込みゼロ(POSTに限らず非GETゼロ)
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((r) => r.method !== "GET")).toEqual([]);

  // (3) 明示操作: 「セットアップ完了 → ライブラリへ」を押した時だけ保存
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("セットアップ完了"),
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await flush();

  const posts = requests.filter((r) => r.method === "POST");
  expect(posts.length).toBe(1);
  expect(posts[0].url).toContain("/api/admin/settings");
  expect(JSON.parse(posts[0].body)).toEqual({ setupCompleted: "true" });
  // 成功後にライブラリへ遷移する
  expect(openedTabs).toEqual(["gallery"]);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
