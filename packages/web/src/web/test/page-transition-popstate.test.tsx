/**
 * 「写真を閉じたあと、次にページを移るとスクロール位置が壊れる」回帰テスト。
 *
 * 写真ビューアは開くとき履歴を1つ積み、閉じるとき history.back() で戻す
 * （Lightbox.tsx）。この pop は URL を変えないので wouter の location も
 * 変わらず、PageTransition の location 変更 effect は走らない。つまり
 * 「戻るボタンで来た」という印が消費されないまま残る。
 *
 * 残った印は、次の本物のページ移動で誤って使われる。移動先の先頭ではなく
 * 前のページのスクロール位置を復元しにいき、届かなければ60ms間隔で20回
 * 繰り返す（最大1.2秒）。写真を開いて閉じただけで、その後のページ移動が
 * 毎回おかしくなっていた。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { navigate } = await import("wouter/use-browser-location");
const { scrollMemory, historyBridge } = await import("../lib/scroll-memory");
const PageTransition = (await import("../components/PageTransition")).default;

const w = dom.window;
const doc = w.document;

const DEEP = 900;

/** window.scrollTo の呼び出しを記録する。 */
function recordScrollTo() {
  const original = w.scrollTo;
  const calls: number[] = [];
  const spy = ((x?: number | ScrollToOptions, y?: number) => {
    calls.push(typeof x === "object" ? (x.top ?? 0) : (y ?? 0));
  }) as typeof w.scrollTo;
  w.scrollTo = spy;
  Object.assign(globalThis, { scrollTo: spy });
  return {
    calls,
    restore: () => {
      w.scrollTo = original;
      Object.assign(globalThis, { scrollTo: original });
    },
  };
}

async function mount() {
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(PageTransition, null, createElement("div", null, "page")),
  );
  await flush(40);
  return () => {
    root.unmount();
    host.remove();
  };
}

afterEach(() => {
  scrollMemory.forget("/gallery");
  w.history.replaceState(null, "", "/");
});

describe("PageTransition と写真ビューアの履歴", () => {
  test("ビューアが自分で戻した popstate は「戻るボタン」として記録しない", async () => {
    w.history.replaceState(null, "", "/gallery");
    scrollMemory.remember("/gallery", DEEP);
    const scroll = recordScrollTo();
    let unmount: (() => void) | undefined;
    try {
      unmount = await mount();

      // ビューアが自分で積んだ履歴を、自分で戻す（Lightbox.tsx と同じ順序で、
      // history.back() の直前に印を付ける）。
      w.history.pushState({ lightbox: true }, "");
      historyBridge.markSelfPop();
      w.history.replaceState(null, "", "/gallery");
      w.dispatchEvent(new w.PopStateEvent("popstate", { state: null }));
      await flush(20);

      // そのあと本物のページ移動をする。
      scroll.calls.length = 0;
      navigate("/about");
      await flush(700);

      expect(scroll.calls.length).toBeGreaterThan(0);
      // 移動先は先頭から始まる。前のページの位置を復元しにいってはいけない。
      expect(scroll.calls).not.toContain(DEEP);
      expect(scroll.calls.every((y) => y === 0)).toBe(true);
    } finally {
      unmount?.();
      scroll.restore();
    }
  });

  test("本物の戻るボタンでは、元いた位置を復元する", async () => {
    w.history.replaceState(null, "", "/gallery");
    scrollMemory.remember("/gallery", DEEP);
    const scroll = recordScrollTo();
    let unmount: (() => void) | undefined;
    try {
      // /about にいるところから、戻るで /gallery へ帰る。
      w.history.replaceState(null, "", "/about");
      unmount = await mount();

      scroll.calls.length = 0;
      w.history.replaceState(null, "", "/gallery");
      w.dispatchEvent(new w.PopStateEvent("popstate", { state: null }));
      await flush(700);

      expect(scroll.calls).toContain(DEEP);
    } finally {
      unmount?.();
      scroll.restore();
    }
  });
});
