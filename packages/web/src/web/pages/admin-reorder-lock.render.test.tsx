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
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
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
let gallerySortOrder = "manual";
let currentPhotoOrder = samplePhotos.map((photo) => photo.id);
let nextReorderStatus = 200;

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
  if (method !== "GET") {
    if (url.includes("/api/admin/photos/reorder")) {
      const bodyText =
        typeof init?.body === "string"
          ? init.body
          : input instanceof Request
            ? await input.clone().text()
            : "";
      const body = JSON.parse(bodyText || "{}") as { ids?: number[] };
      const status = nextReorderStatus;
      nextReorderStatus = 200;
      if (status === 200 && Array.isArray(body.ids))
        currentPhotoOrder = [...body.ids];
      return new Response(
        JSON.stringify(
          status === 200 ? { ok: true } : { error: "保存に失敗しました" },
        ),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return json({ ok: true });
  }
  const orderedPhotos = samplePhotos.map((photo) => ({
    ...photo,
    sortOrder: currentPhotoOrder.indexOf(photo.id),
  }));
  if (url.includes("/api/admin/photos"))
    return json({ photos: orderedPhotos });
  if (url.includes("/api/photos")) return json({ photos: orderedPhotos });
  if (url.includes("/api/admin/setup-health"))
    return json({ storageConfigured: true, missingStorageVariables: [] });
  if (url.includes("/api/categories")) return json({ categories: [] });
  if (url.includes("/api/series")) return json({ series: [] });
  if (url.includes("/api/admin/hero-photos")) return json({ heroPhotos: [] });
  if (url.includes("/api/admin/albums")) return json({ albums: [] });
  if (url.includes("/api/settings")) return json({ gallerySortOrder });
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
  gallerySortOrder = "manual";
  currentPhotoOrder = samplePhotos.map((photo) => photo.id);
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

  // 明示的に「並べる」へ入った時だけ、ロック理由と復帰操作を前面に出す。
  const arrange = host.querySelector<HTMLButtonElement>(
    '[data-library-mode-action="arrange"]',
  );
  expect(arrange).not.toBeNull();
  await act(async () => {
    arrange!.dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true }),
    );
  });
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

test("公開の並び順が手動以外なら開始ボタンを止めて理由を明示する", async () => {
  gallerySortOrder = "shot_desc";
  window.sessionStorage.setItem(
    "admin:librarySort",
    JSON.stringify("manual"),
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

  const arrange = host.querySelector<HTMLButtonElement>(
    '[data-library-mode-action="arrange"]',
  );
  expect(arrange?.disabled).toBe(true);
  expect(host.textContent).toContain(
    "現在の公開並びは手動順ではないため、ここでは並べ替えできません",
  );
  expect(host.querySelector("[data-library-arrange-toolbar]")).toBeNull();

  await act(async () => {
    root.unmount();
  });
  gallerySortOrder = "manual";
});

test("保存成功後だけUndoを出し、Undoも保存して元の順へ戻す", async () => {
  gallerySortOrder = "manual";
  currentPhotoOrder = samplePhotos.map((photo) => photo.id);
  nextReorderStatus = 200;
  window.sessionStorage.setItem(
    "admin:librarySort",
    JSON.stringify("manual"),
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
  const click = async (button: HTMLButtonElement) => {
    await act(async () => {
      button.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      );
    });
    await flush();
    await flush();
  };
  await click(
    host.querySelector<HTMLButtonElement>(
      '[data-library-mode-action="arrange"]',
    )!,
  );
  expect(
    host.querySelector("[data-library-reorder-undo]"),
  ).toBeNull();
  await click(
    host.querySelector<HTMLButtonElement>(
      'button[aria-label="後へ移動"]',
    )!,
  );
  expect(currentPhotoOrder).toEqual([2, 1]);
  expect(host.textContent).toContain("保存済み");
  const undo = host.querySelector<HTMLButtonElement>(
    "[data-library-reorder-undo]",
  );
  expect(undo).not.toBeNull();

  await click(undo!);
  expect(currentPhotoOrder).toEqual([1, 2]);
  expect(host.textContent).toContain("元に戻した順序を保存しました");
  expect(host.querySelector("[data-library-reorder-undo]")).toBeNull();

  await act(async () => {
    root.unmount();
  });
});

test("保存失敗時は操作前の順序へ戻す", async () => {
  gallerySortOrder = "manual";
  currentPhotoOrder = samplePhotos.map((photo) => photo.id);
  nextReorderStatus = 500;
  window.sessionStorage.setItem(
    "admin:librarySort",
    JSON.stringify("manual"),
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
  const arrange = host.querySelector<HTMLButtonElement>(
    '[data-library-mode-action="arrange"]',
  )!;
  await act(async () => {
    arrange.click();
  });
  await flush();
  const move = host.querySelector<HTMLButtonElement>(
    'button[aria-label="後へ移動"]',
  )!;
  await act(async () => {
    move.click();
  });
  await flush();
  await flush();

  expect(currentPhotoOrder).toEqual([1, 2]);
  expect(host.querySelector("[data-library-reorder-status='error']")).not.toBeNull();
  expect(host.querySelector("[data-library-reorder-undo]")).toBeNull();

  await act(async () => {
    root.unmount();
  });
});

test("Undo保存失敗時はUndo前の保存済み順へ戻す", async () => {
  gallerySortOrder = "manual";
  currentPhotoOrder = samplePhotos.map((photo) => photo.id);
  nextReorderStatus = 200;
  window.sessionStorage.setItem(
    "admin:librarySort",
    JSON.stringify("manual"),
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

  const clickAndFlush = async (button: HTMLButtonElement) => {
    await act(async () => {
      button.click();
    });
    await flush();
    await flush();
  };
  await clickAndFlush(
    host.querySelector<HTMLButtonElement>(
      '[data-library-mode-action="arrange"]',
    )!,
  );
  await clickAndFlush(
    host.querySelector<HTMLButtonElement>(
      'button[aria-label="後へ移動"]',
    )!,
  );
  expect(currentPhotoOrder).toEqual([2, 1]);

  nextReorderStatus = 500;
  await clickAndFlush(
    host.querySelector<HTMLButtonElement>(
      "[data-library-reorder-undo]",
    )!,
  );

  expect(currentPhotoOrder).toEqual([2, 1]);
  expect(
    Array.from(
      host.querySelectorAll<HTMLImageElement>(
        ".admin-photo-tile img[alt]",
      ),
    ).map((image) => image.alt),
  ).toEqual(["b", "a"]);
  expect(host.textContent).toContain("Undo前の保存済み順へ戻しました");

  await act(async () => {
    root.unmount();
  });
});
