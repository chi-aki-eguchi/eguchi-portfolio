import { expect, test } from "bun:test";
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
  StorageEvent: dom.window.StorageEvent,
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const {
  ADMIN_LANGUAGE_STORAGE_KEY,
  ADMIN_DICTIONARY,
  AdminLanguageProvider,
  AdminLanguageToggle,
  useAdminI18n,
} = await import("./admin-i18n");

test("common action copy keeps Japanese wording and provides English labels", () => {
  expect(ADMIN_DICTIONARY.ja.common.cancel).toBe("キャンセル");
  expect(ADMIN_DICTIONARY.ja.common.deleteAction).toBe("削除する");
  expect(ADMIN_DICTIONARY.en.common.cancel).toBe("Cancel");
  expect(ADMIN_DICTIONARY.en.common.deleteAction).toBe("Delete");
});

test("Phase 2b copy preserves JP and uses standard photography terms in EN", () => {
  const ja = ADMIN_DICTIONARY.ja.phase2b;
  const en = ADMIN_DICTIONARY.en.phase2b;

  expect(ja.library.sort.options.manual).toBe("手動（保存されている順）");
  expect(ja.library.inspector.shotDate).toBe("撮影日");
  expect(ja.series.coverPhoto).toBe("Cover Photo");
  expect(ja.categories.description).toBe(
    "ギャラリーのフィルターとして使用。↑↓で並び替え（この順で表示されます）。",
  );

  expect(en.library.sort.options.displaySize).toBe("Display size (S→L)");
  expect(en.library.import.film).toBe("Film");
  expect(en.library.import.digital).toBe("Digital");
  expect(en.library.inspector.shotDate).toBe("Date taken");
  expect(en.library.inspector.focalPoint).toBe("Focal point");
  expect(en.library.inspector.sortOrder).toBe("Sort order");
  expect(en.series.cardSummary(1, "Still life")).toBe(
    "1 photo · Cover: Still life",
  );
});

function CopyProbe() {
  const { language, t } = useAdminI18n();
  return createElement(
    "div",
    null,
    createElement(AdminLanguageToggle),
    createElement("span", { "data-copy": true }, t.login.submit),
    createElement("span", { "data-probe-language": true }, language),
  );
}

async function mountProbe() {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        AdminLanguageProvider,
        null,
        createElement(CopyProbe),
      ),
    );
  });
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function languageButton(host: Element, label: "JP" | "EN") {
  return Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  ) as HTMLButtonElement;
}

test("admin language defaults to JP and persists EN across remounts", async () => {
  dom.window.localStorage.clear();
  const first = await mountProbe();
  expect(first.host.querySelector("[data-copy]")?.textContent).toBe("ログイン");
  expect(dom.window.document.documentElement.lang).toBe("ja");
  expect(languageButton(first.host, "JP").getAttribute("aria-pressed")).toBe(
    "true",
  );

  await act(async () => languageButton(first.host, "EN").click());
  expect(first.host.querySelector("[data-copy]")?.textContent).toBe("Sign in");
  expect(dom.window.document.documentElement.lang).toBe("en");
  expect(dom.window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)).toBe(
    "en",
  );
  await first.unmount();

  const second = await mountProbe();
  expect(second.host.querySelector("[data-probe-language]")?.textContent).toBe(
    "en",
  );
  expect(languageButton(second.host, "EN").getAttribute("aria-pressed")).toBe(
    "true",
  );
  await act(async () => languageButton(second.host, "JP").click());
  expect(dom.window.document.documentElement.lang).toBe("ja");
  expect(dom.window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)).toBe(
    "ja",
  );
  await second.unmount();
  dom.window.localStorage.clear();
});

test("invalid stored admin language safely falls back to JP", async () => {
  dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "zh");
  const mounted = await mountProbe();
  expect(mounted.host.querySelector("[data-probe-language]")?.textContent).toBe(
    "ja",
  );
  expect(mounted.host.querySelector("[data-copy]")?.textContent).toBe(
    "ログイン",
  );
  await mounted.unmount();
  dom.window.localStorage.clear();
});

test("nested providers share one admin language state", async () => {
  dom.window.localStorage.clear();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        AdminLanguageProvider,
        null,
        createElement(
          AdminLanguageProvider,
          null,
          createElement(CopyProbe),
        ),
      ),
    );
  });
  await act(async () => languageButton(host, "EN").click());
  expect(host.querySelector("[data-copy]")?.textContent).toBe("Sign in");
  expect(host.querySelectorAll("[data-admin-language-toggle]")).toHaveLength(
    1,
  );
  await act(async () => root.unmount());
  host.remove();
  dom.window.localStorage.clear();
});
