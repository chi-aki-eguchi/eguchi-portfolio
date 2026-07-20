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
let mockPhotos: unknown[] = [];
let mockHeroPhotos: unknown[] = [];
let mockSettings: Record<string, string> = {};
let failingPath = "";
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
  if (failingPath && url.includes(failingPath))
    return new Response("unavailable", { status: 503 });
  if (url.includes("/api/admin/settings") && method === "POST")
    return json({ ok: true });
  if (url.includes("/api/admin/hero-photos"))
    return json({ heroPhotos: mockHeroPhotos });
  if (url.includes("/api/admin/setup-health"))
    return json({ storageConfigured: true, missingStorageVariables: [] });
  if (url.includes("/api/settings")) return json(mockSettings);
  if (url.includes("/api/photos")) return json({ photos: mockPhotos });
  if (url.includes("/api/categories")) return json({ categories: [] });
  return json({});
}) as typeof fetch;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");
const { SetupTab } = await import("./admin");
const { ADMIN_LANGUAGE_STORAGE_KEY, AdminLanguageProvider } =
  await import("./admin-i18n");

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

async function renderSetup(language: "ja" | "en", width: number) {
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, language);
  Object.defineProperty(dom.window, "innerWidth", { value: width, configurable: true });
  dom.window.dispatchEvent(new dom.window.Event("resize"));
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
          createElement(SetupTab, { onOpenTab: () => undefined }),
        ),
      ),
    );
  });
  for (let i = 0; i < 10; i++) await flush();
  return { container, root };
}

test("SetupTab — 未完了時は完了保存せず、次の項目へ案内する", async () => {
  dom.window.localStorage.clear();
  requests.length = 0;
  mockPhotos = [];
  mockHeroPhotos = [];
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
    if (container.textContent?.includes("次へ：写真を1枚追加する")) break;
  }

  // (2) 画面を開いただけでは書き込みゼロ(POSTに限らず非GETゼロ)
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((r) => r.method !== "GET")).toEqual([]);

  // 未完了時の主ボタンは完了保存ではなく、最初の作業へ移動する。
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("次へ：写真を1枚追加する"),
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await flush();

  expect(requests.filter((r) => r.method === "POST")).toEqual([]);
  expect(openedTabs).toEqual(["gallery"]);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("SetupTab — 3項目完了後だけsetupCompletedを保存する", async () => {
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(
    "admin:setup-home-page-confirmed",
    JSON.stringify(true),
  );
  requests.length = 0;
  mockPhotos = [{ id: 1, deletedAt: null, isPublished: true }];
  mockHeroPhotos = [{ id: 1, photoId: 1 }];
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
  for (let i = 0; i < 10; i++) {
    await flush();
    if (container.textContent?.includes("セットアップ完了")) break;
  }
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("セットアップ完了"),
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
  await flush();
  const posts = requests.filter((r) => r.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0].body)).toEqual({ setupCompleted: "true" });
  expect(openedTabs).toEqual(["gallery"]);
  await act(async () => root.unmount());
  container.remove();
  mockPhotos = [];
  mockHeroPhotos = [];
});

test("SetupTab — ENではPhase 2aチェックリストを英語表示し、表示だけでは書き込まない", async () => {
  dom.window.localStorage.clear();
  dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "en");
  requests.length = 0;
  mockPhotos = [];
  mockHeroPhotos = [];
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
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
          createElement(SetupTab, { onOpenTab: () => undefined }),
        ),
      ),
    );
  });
  for (let i = 0; i < 10; i++) {
    await flush();
    if (container.textContent?.includes("Next: Upload one photo")) break;
  }

  expect(container.textContent).toContain("Before you publish");
  expect(container.textContent).toContain("Upload one photo");
  expect(container.textContent).toContain("Choose a hero photo");
  expect(container.textContent).toContain("Check the home page");
  expect(container.textContent).toContain("Next: Upload one photo");
  expect(requests.filter((request) => request.method !== "GET")).toEqual([]);

  await act(async () => root.unmount());
  container.remove();
  dom.window.localStorage.clear();
});

test("SetupTab — 日英・desktop/mobileで取得失敗を未完了扱いにせず再試行を案内する", async () => {
  mockSettings = {};
  mockPhotos = [];
  mockHeroPhotos = [];
  for (const language of ["ja", "en"] as const) {
    for (const width of [1280, 390]) {
      for (const path of ["/api/settings", "/api/photos", "/api/admin/hero-photos"]) {
        failingPath = path;
        const { container, root } = await renderSetup(language, width);
        expect(container.textContent).toContain(
          language === "ja" ? "読み込めませんでした" : "Could not load your setup",
        );
        expect(container.textContent).toContain(
          language === "ja" ? "再試行" : "Try again",
        );
        expect(container.textContent).not.toContain("0 / 3");
        await act(async () => root.unmount());
        container.remove();
      }
    }
  }
  failingPath = "";
});

test("SetupTab — setupCompletedは別端末でも3項目の完了状態を復元する", async () => {
  failingPath = "";
  mockSettings = { setupCompleted: "true" };
  mockPhotos = [];
  mockHeroPhotos = [];
  for (const language of ["ja", "en"] as const) {
    for (const width of [1280, 390]) {
      const { container, root } = await renderSetup(language, width);
      expect(container.textContent).toContain(
        language === "ja" ? "セットアップ完了ずみです" : "Setup is complete",
      );
      expect(container.textContent).not.toContain("2 / 3");
      await act(async () => root.unmount());
      container.remove();
    }
  }
  mockSettings = {};
});

test("SetupTab — 非公開のトップ写真と開けなかったトップページは完了にしない", async () => {
  failingPath = "";
  mockSettings = {};
  mockPhotos = [{ id: 7, deletedAt: null, isPublished: false }];
  mockHeroPhotos = [{ id: 1, photoId: 7 }];
  const originalOpen = dom.window.open;
  dom.window.open = (() => null) as typeof dom.window.open;
  const { container, root } = await renderSetup("ja", 1280);
  expect(container.textContent).toContain("1 / 3 完了");

  const openButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "開く" && button.closest("div")?.textContent?.includes("トップページで確認する"),
  );
  expect(openButton).toBeDefined();
  await act(async () => openButton!.click());
  expect(
    JSON.parse(
      dom.window.localStorage.getItem("admin:setup-home-page-confirmed") ??
        "false",
    ),
  ).toBe(false);

  await act(async () => root.unmount());
  container.remove();
  dom.window.open = originalOpen;
  mockPhotos = [];
  mockHeroPhotos = [];
});

test("SetupTab — 初回画面から設定担当者向けの技術説明を隔離する", async () => {
  failingPath = "";
  mockSettings = {};
  mockPhotos = [];
  mockHeroPhotos = [];
  const { container, root } = await renderSetup("ja", 390);
  expect(container.textContent).not.toContain("公開の裏側");
  expect(container.textContent).not.toContain("環境変数");
  expect(container.textContent).not.toContain("OGP");
  await act(async () => root.unmount());
  container.remove();
});
