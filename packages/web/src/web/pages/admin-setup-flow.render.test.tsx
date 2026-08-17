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
const { ADMIN_LANGUAGE_STORAGE_KEY, AdminLanguageProvider, AdminLanguageToggle } =
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
          createElement(
            "div",
            null,
            createElement(AdminLanguageToggle),
            createElement(SetupTab, { onOpenTab: () => undefined }),
          ),
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

test("SetupTab — setupCompletedは別端末でも、現在公開中のHeroがあれば完了状態を復元する", async () => {
  failingPath = "";
  mockSettings = { setupCompleted: "true" };
  mockPhotos = [{ id: 1, deletedAt: null, isPublished: true }];
  mockHeroPhotos = [{ id: 1, photoId: 1 }];
  for (const language of ["ja", "en"] as const) {
    for (const width of [1280, 390]) {
      const { container, root } = await renderSetup(language, width);
      expect(container.textContent).toContain(
        language === "ja" ? "セットアップは完了しています" : "Setup is complete",
      );
      expect(container.textContent).not.toContain("2 / 3");
      await act(async () => root.unmount());
      container.remove();
    }
  }
  mockSettings = {};
  mockPhotos = [];
  mockHeroPhotos = [];
});

test("SetupTab — setupCompleted後に公開Heroがなくなれば、現在の公開状態を示す", async () => {
  failingPath = "";
  mockSettings = { setupCompleted: "true" };

  for (const scenario of [
    {
      photo: { id: 7, deletedAt: null, isPublished: false },
      progress: "1 / 3 完了",
      next: "トップ写真を選ぶ",
    },
    {
      photo: { id: 7, deletedAt: "2026-08-12T00:00:00.000Z", isPublished: true },
      progress: "0 / 3 完了",
      next: "写真を1枚追加する",
    },
  ]) {
    mockPhotos = [scenario.photo];
    mockHeroPhotos = [{ id: 1, photoId: 7 }];
    const { container, root } = await renderSetup("ja", 1280);
    expect(container.textContent).not.toContain("セットアップは完了しています");
    expect(container.textContent).toContain(scenario.progress);
    expect(container.textContent).toContain(`次へ：${scenario.next}`);
    await act(async () => root.unmount());
    container.remove();
  }

  mockSettings = {};
  mockPhotos = [];
  mockHeroPhotos = [];
});

test("SetupTab — トップページを開くだけでは完了にせず、表示確認で完了にする", async () => {
  failingPath = "";
  requests.length = 0;
  mockSettings = {};
  mockPhotos = [{ id: 7, deletedAt: null, isPublished: true }];
  mockHeroPhotos = [{ id: 1, photoId: 7 }];
  const originalOpen = dom.window.open;
  try {
    for (const scenario of [
      {
        language: "ja" as const,
        title: "トップページで確認する",
        nextAction: "次へ：トップページで確認する",
        confirmation: "写真が表示された",
        incomplete: "2 / 3 完了",
        complete: "3 / 3 完了",
      },
      {
        language: "en" as const,
        title: "Check the home page",
        nextAction: "Next: Check the home page",
        confirmation: "I can see the photo",
        incomplete: "2 / 3 complete",
        complete: "3 / 3 complete",
      },
    ]) {
      const openedWindow = { opener: dom.window } as unknown as Window;
      dom.window.open = (() => openedWindow) as typeof dom.window.open;
      const { container, root } = await renderSetup(scenario.language, 390);
      expect(container.textContent).toContain(scenario.incomplete);

      const openButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === scenario.nextAction && button.closest("header"),
      );
      expect(openButton).toBeDefined();
      await act(async () => openButton!.click());
      await flush();

      expect(openedWindow.opener).toBeNull();
      expect(
        JSON.parse(
          dom.window.localStorage.getItem("admin:setup-home-page-confirmed") ??
            "false",
        ),
      ).toBe(false);
      expect(requests.filter((request) => request.method === "POST")).toEqual([]);

      const rowConfirmButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === scenario.confirmation && !button.closest("header"),
      );
      expect(rowConfirmButton).toBeDefined();
      const confirmButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === scenario.confirmation && button.closest("header"),
      );
      expect(confirmButton).toBeDefined();
      await act(async () => confirmButton!.click());
      await flush();

      expect(
        JSON.parse(
          dom.window.localStorage.getItem("admin:setup-home-page-confirmed") ??
            "false",
        ),
      ).toBe(true);
      expect(container.textContent).toContain(scenario.complete);
      expect(
        Array.from(container.querySelectorAll("button")).some(
          (button) => button.textContent === scenario.confirmation,
        ),
      ).toBe(false);

      await act(async () => root.unmount());
      container.remove();
    }
  } finally {
    dom.window.open = originalOpen;
    mockPhotos = [];
    mockHeroPhotos = [];
  }
});

test("SetupTab — ポップアップを開けない時は日英で案内し、表示確認を出さない", async () => {
  failingPath = "";
  mockSettings = {};
  mockPhotos = [{ id: 7, deletedAt: null, isPublished: true }];
  mockHeroPhotos = [{ id: 1, photoId: 7 }];
  const originalOpen = dom.window.open;
  dom.window.open = (() => null) as typeof dom.window.open;
  try {
    for (const scenario of [
      {
        language: "ja" as const,
        title: "トップページで確認する",
        open: "開く",
        notice:
          "トップページを新しいタブで開けませんでした。ブラウザでポップアップを許可して、もう一度「開く」を押してください。",
        confirmation: "写真が表示された",
      },
      {
        language: "en" as const,
        title: "Check the home page",
        open: "Open",
        notice:
          "The home page could not open in a new tab. Allow pop-ups in your browser, then select “Open” again.",
        confirmation: "I can see the photo",
      },
    ]) {
      const { container, root } = await renderSetup(scenario.language, 390);
      const openButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === scenario.open && button.closest("div")?.textContent?.includes(scenario.title),
      );
      expect(openButton).toBeDefined();
      await act(async () => openButton!.click());
      await flush();

      expect(container.textContent).toContain(scenario.notice);
      expect(
        Array.from(container.querySelectorAll("button")).some(
          (button) => button.textContent === scenario.confirmation,
        ),
      ).toBe(false);
      expect(
        JSON.parse(
          dom.window.localStorage.getItem("admin:setup-home-page-confirmed") ??
            "false",
        ),
      ).toBe(false);

      if (scenario.language === "ja") {
        const englishButton = container.querySelector(
          '[data-admin-language-toggle] button:nth-of-type(2)',
        ) as HTMLButtonElement | null;
        expect(englishButton).not.toBeNull();
        await act(async () => englishButton!.click());
        await flush();
        expect(container.textContent).toContain(
          "The home page could not open in a new tab. Allow pop-ups in your browser, then select “Open” again.",
        );
      }

      await act(async () => root.unmount());
      container.remove();
    }
  } finally {
    dom.window.open = originalOpen;
    mockPhotos = [];
    mockHeroPhotos = [];
  }
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

test("SetupTab — 連絡先は実際に使えるメールかHTTPS送信先だけを完了にする", async () => {
  failingPath = "";
  mockPhotos = [];
  mockHeroPhotos = [];
  try {
    for (const scenario of [
      {
        language: "ja" as const,
        width: 1440,
        title: "連絡先",
        settings: { contactEmail: "not-an-email" } as Record<string, string>,
        done: false,
      },
      {
        language: "en" as const,
        width: 390,
        title: "Contact",
        settings: {
          formspreeUrl: "http://compatible.example.test/contact",
        } as Record<string, string>,
        done: false,
      },
      {
        language: "ja" as const,
        width: 390,
        title: "連絡先",
        settings: {
          contactEmail: "  hello@example.test  ",
        } as Record<string, string>,
        done: true,
      },
      {
        language: "en" as const,
        width: 1440,
        title: "Contact",
        settings: {
          formspreeUrl: " https://compatible.example.test/contact ",
        } as Record<string, string>,
        done: true,
      },
    ]) {
      requests.length = 0;
      mockSettings = scenario.settings;
      const { container, root } = await renderSetup(
        scenario.language,
        scenario.width,
      );
      try {
        const title = Array.from(container.querySelectorAll("h3")).find(
          (heading) => heading.textContent === scenario.title,
        );
        const row = title?.closest("div.border");
        expect(row, `${scenario.language}の連絡先行が表示される`).not.toBeNull();
        expect(row?.querySelector(".admin-icon-success") !== null).toBe(
          scenario.done,
        );
        expect(requests.filter((request) => request.method !== "GET")).toEqual(
          [],
        );
      } finally {
        await act(async () => root.unmount());
        container.remove();
      }
    }
  } finally {
    mockSettings = {};
    mockPhotos = [];
    mockHeroPhotos = [];
  }
});
