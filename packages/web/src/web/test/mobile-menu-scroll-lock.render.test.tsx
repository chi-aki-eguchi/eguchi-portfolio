/**
 * スマホのメニューを開いている間、後ろを止める回帰テスト。
 *
 * 2026-08-11 実測: メニューを開いたまま指を動かすと、**ページだけが流れて
 * メニューが宙に浮いたまま残っていた**（開く前 300px → ホイール後 700px）。
 * 写真ビューアは既に `overflow:hidden` で後ろを止めており、開いている面が
 * ひとつだけ動く状態を作らないのがこのサイトの約束。
 *
 * **元の値へ戻すことまで縛る。** 空文字を入れて戻すと、ビューアが同時に
 * 開いているときに、そちらの固定まで解いてしまう。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router } = await import("wouter");
const Layout = (await import("../components/Layout")).default;

const doc = dom.window.document;

async function mountLayout() {
  canned["/api/settings"] = {};
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        Router,
        null,
        createElement(Layout, null, createElement("div", null, "page")) as never,
      ),
    ),
  );
  await flush(120);
  // ハンバーガーは header の最後のボタン
  const buttons = [...host.querySelectorAll("header button")];
  return {
    host,
    menuButton: buttons[buttons.length - 1] as HTMLButtonElement | undefined,
    cleanup: () => {
      root.unmount();
      host.remove();
      doc.body.style.overflow = "";
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
  doc.body.style.overflow = "";
});

describe("スマホメニューを開いている間", () => {
  test("後ろを止め、閉じたら元に戻す", async () => {
    const m = await mountLayout();
    try {
      expect(m.menuButton, "ハンバーガーが要る").toBeDefined();
      expect(doc.body.style.overflow).not.toBe("hidden");

      m.menuButton!.click();
      await flush(60);
      expect(doc.body.style.overflow, "開いている間は止める").toBe("hidden");

      m.menuButton!.click();
      await flush(60);
      expect(doc.body.style.overflow, "閉じたら戻す").not.toBe("hidden");
    } finally {
      m.cleanup();
    }
  });

  test("元の値へ戻す（同時に開いている面の固定を解かない）", async () => {
    // 写真ビューアが先に止めている状態を作る
    doc.body.style.overflow = "hidden";
    const m = await mountLayout();
    try {
      m.menuButton!.click();
      await flush(60);
      expect(doc.body.style.overflow).toBe("hidden");

      m.menuButton!.click();
      await flush(60);
      // ビューアがまだ開いているので、hidden のままでなければならない
      expect(
        doc.body.style.overflow,
        "空文字で戻すと、ビューア側の固定まで解ける",
      ).toBe("hidden");
    } finally {
      m.cleanup();
    }
  });
});
