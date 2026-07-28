import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body></body></html>",
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
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let failSettingsRefetch = false;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/api/settings")) {
    if (failSettingsRefetch) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { AdminLanguageProvider } = await import("./admin-i18n");
const { ServiceTab } = await import("./admin-tabs");

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

test("ServiceTab — 初回取得失敗では編集欄を出さず、再試行成功で戻る", async () => {
  dom.window.sessionStorage.clear();
  failSettingsRefetch = true;
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
          createElement(ServiceTab),
        ),
      ),
    );
  });
  for (let i = 0; i < 5; i++) await flush();

  expect(container.textContent).toContain("読み込めませんでした");
  expect(container.querySelector("input, textarea")).toBeNull();

  const retryButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("再試行"),
  );
  expect(retryButton).toBeDefined();

  failSettingsRefetch = false;
  await act(async () => retryButton?.click());
  for (let i = 0; i < 5; i++) await flush();

  expect(container.textContent).not.toContain("読み込めませんでした");
  expect(container.querySelector("input, textarea")).not.toBeNull();

  await act(async () => root.unmount());
  container.remove();
  qc.clear();
});

test("ServiceTab — 成功済み設定の再取得失敗では編集画面も未保存警告も消さない", async () => {
  dom.window.sessionStorage.clear();
  failSettingsRefetch = false;
  const onUnsavedChange: boolean[] = [];
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
          createElement(ServiceTab, {
            onUnsavedChange: (value: boolean) => onUnsavedChange.push(value),
          }),
        ),
      ),
    );
  });
  for (let i = 0; i < 5; i++) await flush();

  expect(container.querySelector("input, textarea")).not.toBeNull();
  const unsavedSignalsBeforeRefetch = onUnsavedChange.length;

  failSettingsRefetch = true;
  await act(async () => {
    await qc.invalidateQueries({ queryKey: ["settings"] });
  });
  for (let i = 0; i < 5; i++) await flush();

  expect(container.querySelector("input, textarea")).not.toBeNull();
  expect(container.textContent).not.toContain("読み込めませんでした");
  expect(onUnsavedChange).toHaveLength(unsavedSignalsBeforeRefetch);

  await act(async () => root.unmount());
  container.remove();
  qc.clear();
});
