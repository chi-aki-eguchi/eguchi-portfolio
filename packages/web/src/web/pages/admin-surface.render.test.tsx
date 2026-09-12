/**
 * 「表示の明るさ」— 単一の 44px 操作からラベル付きメニューを開き、
 * 明るい / 暗い / サイトに合わせる を選ぶ。現在の選択に印が付く。
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { setupDom, flush } from "../test/jsdom-setup";

const dom = setupDom();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AdminSurfaceProvider, AdminSurfaceToggle } = await import("./admin-surface");
let preference: "light" | "dark" | "site" = "dark";
let setCalls: string[] = [];

function Harness() {
  return createElement(
    AdminSurfaceProvider,
    {
      value: {
        preference,
        resolved: preference === "site" ? "light" : preference,
        setPreference: (next: "light" | "dark" | "site") => {
          setCalls.push(next);
          preference = next;
        },
      },
    },
    createElement(AdminSurfaceToggle, {}),
  );
}

async function mount() {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(Harness)));
  await flush();
  return host;
}
const click = (el: Element | null) =>
  el?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

beforeEach(() => {
  preference = "dark";
  setCalls = [];
});

describe("AdminSurfaceToggle", () => {
  test("常時は単一のトリガーだけ（3アイコンを並べない）", async () => {
    const host = await mount();
    const trigger = host.querySelector(".admin-surface-toggle__trigger");
    expect(trigger).not.toBeNull();
    expect(host.querySelectorAll(".admin-surface-toggle__item")).toHaveLength(0);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-label")).toContain("暗い");
  });

  test("押すと3項目のメニューが開き、現在の選択に印が付く", async () => {
    const host = await mount();
    await act(async () => click(host.querySelector(".admin-surface-toggle__trigger")));
    const items = [...host.querySelectorAll(".admin-surface-toggle__item")];
    expect(items).toHaveLength(3);
    const checked = items.find((i) => i.getAttribute("aria-checked") === "true");
    expect(checked?.textContent).toContain("暗い");
  });

  test("項目を選ぶと setPreference が呼ばれメニューが閉じる", async () => {
    const host = await mount();
    await act(async () => click(host.querySelector(".admin-surface-toggle__trigger")));
    const light = [...host.querySelectorAll(".admin-surface-toggle__item")].find((i) =>
      i.textContent?.includes("明るい"),
    );
    await act(async () => click(light ?? null));
    expect(setCalls).toEqual(["light"]);
    expect(host.querySelectorAll(".admin-surface-toggle__item")).toHaveLength(0);
  });

  test("ArrowDown で開くと、現在の選択項目へフォーカスが移る", async () => {
    const host = await mount();
    const trigger = host.querySelector<HTMLButtonElement>(".admin-surface-toggle__trigger")!;
    trigger.focus();
    await act(async () => {
      trigger.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    await flush();
    const items = [...host.querySelectorAll<HTMLButtonElement>(".admin-surface-toggle__item")];
    expect(items).toHaveLength(3);
    expect(dom.window.document.activeElement?.textContent).toContain("暗い");
  });

  test("ArrowDown/ArrowUp・Home/End でメニュー内を移動する", async () => {
    const host = await mount();
    const trigger = host.querySelector<HTMLButtonElement>(".admin-surface-toggle__trigger")!;
    await act(async () => click(trigger));
    await flush();
    const menu = host.querySelector<HTMLDivElement>('[role="menu"]')!;
    const items = () => [...host.querySelectorAll<HTMLButtonElement>(".admin-surface-toggle__item")];
    const fire = (key: string) => menu.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await act(async () => fire("Home"));
    expect(dom.window.document.activeElement).toBe(items()[0]);
    await act(async () => fire("End"));
    expect(dom.window.document.activeElement).toBe(items()[2]);
    await act(async () => fire("ArrowUp"));
    expect(dom.window.document.activeElement).toBe(items()[1]);
  });

  test("Escape で閉じてトリガーへフォーカスが戻る", async () => {
    const host = await mount();
    const trigger = host.querySelector<HTMLButtonElement>(".admin-surface-toggle__trigger")!;
    await act(async () => click(trigger));
    await flush();
    const menu = host.querySelector<HTMLDivElement>('[role="menu"]')!;
    await act(async () => {
      menu.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(host.querySelectorAll(".admin-surface-toggle__item")).toHaveLength(0);
    expect(dom.window.document.activeElement).toBe(trigger);
  });

  test("項目を選ぶとトリガーへフォーカスが戻る", async () => {
    const host = await mount();
    const trigger = host.querySelector<HTMLButtonElement>(".admin-surface-toggle__trigger")!;
    await act(async () => click(trigger));
    const light = [...host.querySelectorAll(".admin-surface-toggle__item")].find((i) =>
      i.textContent?.includes("明るい"),
    );
    await act(async () => click(light ?? null));
    expect(dom.window.document.activeElement).toBe(trigger);
  });

  test("context が無ければ何も描かない", async () => {
    const host = dom.window.document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(AdminSurfaceToggle, {})));
    await flush();
    expect(host.textContent).toBe("");
  });
});
