/**
 * Render test: 保存先未設定の専用UI(はじめにの状態表示+アップロード時バナー)
 * が、実際のDOMで初心者向け日本語文面・不足変数名(値なし)・再デプロイ案内を
 * 表示することを検証する(Codexレビュー P1-1/P1-2/P1-3 のフォローアップ)。
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
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { StorageAlertBanner, StorageHealthLine } =
  await import("./AdminStorageNotice");
const { ADMIN_DICTIONARY } = await import("../pages/admin-i18n");
const jaStorageCopy = ADMIN_DICTIONARY.ja.setup.storageHealth;

function renderToText(element: React.ReactElement): {
  text: string;
  html: string;
} {
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  const result = {
    text: container.textContent ?? "",
    html: container.innerHTML,
  };
  act(() => {
    root.unmount();
  });
  container.remove();
  return result;
}

test("StorageHealthLine — 設定入力済みでも「接続済み」と言い切らない", () => {
  const { text } = renderToText(
    createElement(StorageHealthLine, {
      health: { storageConfigured: true, missingStorageVariables: [] },
      copy: jaStorageCopy,
    }),
  );
  expect(text).toContain("必要な設定は入力済み");
  expect(text).toContain("最初のアップロードで確認");
  expect(text).not.toContain("接続済み");
});

test("StorageHealthLine — 不足時は変数名と対処を表示する(値は出さない)", () => {
  const { text } = renderToText(
    createElement(StorageHealthLine, {
      health: {
        storageConfigured: false,
        missingStorageVariables: ["S3_BUCKET", "S3_ENDPOINT"],
      },
      copy: jaStorageCopy,
    }),
  );
  expect(text).toContain("設定が不足しています");
  expect(text).toContain("S3_BUCKET, S3_ENDPOINT");
  expect(text).toContain("再デプロイ");
  expect(text).toContain("サイトを設定した人へこの画面を送ってください");
});

test("StorageHealthLine — health未取得なら何も出さない", () => {
  const { text } = renderToText(
    createElement(StorageHealthLine, { copy: jaStorageCopy }),
  );
  expect(text).toBe("");
});

test("StorageHealthLine — 英語辞書で接続状態と対処を表示する", () => {
  const { text } = renderToText(
    createElement(StorageHealthLine, {
      health: {
        storageConfigured: false,
        missingStorageVariables: ["S3_BUCKET"],
      },
      copy: ADMIN_DICTIONARY.en.setup.storageHealth,
    }),
  );
  expect(text).toContain("Photo storage: Settings are missing");
  expect(text).toContain("In Railway Variables, check S3_BUCKET");
  expect(text).toContain("redeploy");
});

test("StorageAlertBanner — 専用日本語文面+明背景で読める色の不足変数名", () => {
  const { text, html } = renderToText(
    createElement(StorageAlertBanner, {
      missing: ["S3_BUCKET"],
      canRetry: true,
      onRetry: () => {},
      onClose: () => {},
    }),
  );
  expect(text).toContain("写真の保存先がまだ接続されていません。");
  expect(text).toContain("不足している設定: S3_BUCKET");
  expect(text).toContain("再デプロイ");
  expect(text).toContain("設定を直したあとに再試行する");
  // P1-3: 明るいadmin背景で読めない text-amber-300 を使わない
  expect(html).not.toContain("text-amber-300");
  expect(html).toContain("text-amber-800");
});

test("StorageAlertBanner — 再試行できない時はボタンを出さない", () => {
  const { text } = renderToText(
    createElement(StorageAlertBanner, {
      missing: [],
      canRetry: false,
      onRetry: () => {},
      onClose: () => {},
    }),
  );
  expect(text).not.toContain("再試行");
  expect(text).toContain("S3_BUCKET など");
});
