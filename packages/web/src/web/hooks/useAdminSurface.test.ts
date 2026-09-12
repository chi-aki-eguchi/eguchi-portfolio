/**
 * 管理画面だけの明暗の選択（端末ローカル・既定は暗い）。公開サイトの
 * `theme-preference` とは別のキーで持ち、DB には保存しない。
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { setupDom, flush } from "../test/jsdom-setup";

const dom = setupDom();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, useState, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useAdminSurface } = await import("./useAdminSurface");

let lastValue: ReturnType<typeof useAdminSurface> | null = null;
let setSite: ((s: "light" | "dark") => void) | null = null;

function Probe({ initialSite }: { initialSite: "light" | "dark" }) {
  const [site, setSiteState] = useState<"light" | "dark">(initialSite);
  setSite = setSiteState;
  lastValue = useAdminSurface(site);
  return null;
}

async function mount(initialSite: "light" | "dark" = "light") {
  const host = dom.window.document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(Probe, { initialSite }));
  });
  await flush();
  return root;
}

beforeEach(() => {
  window.localStorage.clear();
  lastValue = null;
  setSite = null;
});

describe("useAdminSurface", () => {
  test("未選択の既定は dark（オーナーは黒ベース希望）", async () => {
    await mount("light");
    expect(lastValue?.preference).toBe("dark");
    expect(lastValue?.resolved).toBe("dark");
  });

  test("保存済みの選択を保持する", async () => {
    window.localStorage.setItem("admin-surface-preference", "light");
    await mount("dark");
    expect(lastValue?.preference).toBe("light");
    expect(lastValue?.resolved).toBe("light");
  });

  test('"site" は公開サイトの解決結果に追従する', async () => {
    window.localStorage.setItem("admin-surface-preference", "site");
    await mount("dark");
    expect(lastValue?.resolved).toBe("dark");
    await act(async () => setSite?.("light"));
    expect(lastValue?.resolved).toBe("light");
  });

  test("選択は localStorage に残り、公開サイトのキーは触らない", async () => {
    window.localStorage.setItem("theme-preference", "light");
    await mount("light");
    await act(async () => lastValue?.setPreference("dark"));
    expect(window.localStorage.getItem("admin-surface-preference")).toBe("dark");
    expect(window.localStorage.getItem("theme-preference")).toBe("light");
  });

  test("壊れた保存値は既定へ落とす", async () => {
    window.localStorage.setItem("admin-surface-preference", "banana");
    await mount("light");
    expect(lastValue?.preference).toBe("dark");
  });
});
