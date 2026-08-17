/**
 * 「絞り込んだギャラリーを長く見て、Aboutを開いて戻ると先頭からやり直しになる」
 * の回帰テスト。
 *
 * 原因は目印の食い違いだった。位置を覚える側は wouter の `useLocation`
 * （`location.pathname` しか返さない）を鍵にし、戻ってきたことを知る側は
 * `window.location.pathname + search` を鍵にしていた。絞り込みが無いときは
 * どちらも `/gallery` なので一致し、既存テストも通っていた。**絞り込みが
 * 付いた瞬間だけ** `/gallery` で覚えて `/gallery?c=portrait` で探すことになり、
 * スクロール位置も「どこまで読み込んでいたか」も両方0が返っていた。
 *
 * なので、ここでは**覚える側の鍵**を測る。復元側だけ測ると、テストが自分で
 * 正しい鍵を書き込んでしまい、バグをすり抜ける。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { scrollMemory, routeKeyOf } = await import("../lib/scroll-memory");
const PageTransition = (await import("../components/PageTransition")).default;

const w = dom.window;
const doc = w.document;

const FILTERED = "/gallery?c=portrait";
const DEEP = 2400;

function setScrollY(y: number) {
  Object.defineProperty(w, "scrollY", { value: y, configurable: true });
  Object.assign(globalThis, { scrollY: y });
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
  scrollMemory.forget(FILTERED);
  scrollMemory.forget("/about");
  setScrollY(0);
  w.history.replaceState(null, "", "/");
});

describe("絞り込み中のギャラリーの位置記憶", () => {
  test("鍵は「?以降」まで含む。絞り込みごとに別の位置として覚える", () => {
    expect(routeKeyOf("/gallery", "?c=portrait")).toBe(FILTERED);
    // 既定（絞り込み無し）は素の /gallery のまま。B-19 の「既定はURLに書かない」
    // 方針を崩さないこと。
    expect(routeKeyOf("/gallery", "")).toBe("/gallery");
    // useSearch が先頭の ? を落とす形で渡ってきても同じ鍵になる。
    expect(routeKeyOf("/gallery", "c=portrait")).toBe(FILTERED);
  });

  test("絞り込み中にスクロールした位置は、絞り込み付きの鍵で覚える", async () => {
    w.history.replaceState(null, "", FILTERED);
    let unmount: (() => void) | undefined;
    try {
      unmount = await mount();

      setScrollY(DEEP);
      w.dispatchEvent(new w.Event("scroll"));
      await flush(20);

      expect(scrollMemory.get(FILTERED)).toBe(DEEP);
      // 絞り込みを外した画面は別物なので、そちらへ書いてはいけない。
      expect(scrollMemory.get("/gallery")).toBe(0);
    } finally {
      unmount?.();
    }
  });

  test("絞り込んだまま出ていって戻ると、その位置へ復元する", async () => {
    w.history.replaceState(null, "", FILTERED);
    const original = w.scrollTo;
    const calls: number[] = [];
    const spy = ((x?: number | ScrollToOptions, y?: number) => {
      calls.push(typeof x === "object" ? (x.top ?? 0) : (y ?? 0));
    }) as typeof w.scrollTo;
    w.scrollTo = spy;
    Object.assign(globalThis, { scrollTo: spy });

    let unmount: (() => void) | undefined;
    try {
      unmount = await mount();

      // 深くまで見る。
      setScrollY(DEEP);
      w.dispatchEvent(new w.Event("scroll"));
      await flush(20);

      // About を開く（前へ進む移動なので先頭から）。
      w.history.pushState(null, "", "/about");
      await flush(700);

      // 戻るボタンで絞り込んだギャラリーへ帰る。
      calls.length = 0;
      w.history.replaceState(null, "", FILTERED);
      w.dispatchEvent(new w.PopStateEvent("popstate", { state: null }));
      await flush(700);

      expect(calls).toContain(DEEP);
    } finally {
      unmount?.();
      w.scrollTo = original;
      Object.assign(globalThis, { scrollTo: original });
    }
  });

  test("読み込んでいた束の数も、絞り込み付きの鍵で受け渡す", () => {
    // gallery.tsx が使う経路そのもの。markRestoring と peekBatches の鍵が
    // 揃っていないと、戻っても最初のひと束しか描かれない（B-18）。
    scrollMemory.rememberBatches(FILTERED, 60);
    scrollMemory.markRestoring(FILTERED);
    expect(scrollMemory.peekBatches(FILTERED)).toBe(60);

    // 前へ進んで入り直したときは使わない。
    scrollMemory.clearRestoring();
    expect(scrollMemory.peekBatches(FILTERED)).toBe(0);
  });
});
