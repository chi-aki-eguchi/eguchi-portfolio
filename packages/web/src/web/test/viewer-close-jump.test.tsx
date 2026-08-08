/**
 * 写真を閉じたときに画面が「カクッ」と跳ねる問題の回帰テスト。
 *
 * 原因は2つあった。どちらも、閉じた瞬間に背景のページが動くこと。
 *
 * 1. スクロールロックで横幅が変わる。ビューアは開いている間 body の
 *    スクロールを止めるが、そうするとスクロールバーが消え、その幅ぶん
 *    ページ本体が広がる。閉じるアニメーションの途中で背景は透けて見えて
 *    いるので、元の幅へ戻る瞬間が横跳ねとして見える。
 *    実測: gallery で本文の幅が 1276px → 1280px。
 *
 * 2. 閉じたあと、次にページを移ったときのスクロール位置が壊れる。
 *    ビューアは開くとき履歴を1つ積み、閉じるとき history.back() で戻す。
 *    その popstate を PageTransition が「戻るボタンで来た」と記録するが、
 *    URLが変わらないので location 変更 effect が走らず、印が消費されない。
 *    残った印は次の本物のページ移動で誤って使われ、移動先で前のページの
 *    スクロール位置を復元しにいく（最大20回・1.2秒間の scrollTo）。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, samplePhotos, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);

const doc = dom.window.document;

/** documentElement.clientWidth を差し替えて、スクロールバーの幅を作る。 */
function withScrollbarWidth(px: number) {
  const de = doc.documentElement;
  Object.defineProperty(de, "clientWidth", {
    configurable: true,
    get: () => dom.window.innerWidth - px,
  });
  return () => {
    delete (de as unknown as Record<string, unknown>).clientWidth;
  };
}

async function mountViewer() {
  const photos = samplePhotos.map((p) => ({ url: p.url, title: p.title }));
  const { Lightbox } = await import("../components/Lightbox");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      StrictMode,
      null,
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(Lightbox, {
          photos,
          index: 0,
          onClose: () => {},
          onPrev: () => {},
          onNext: () => {},
        }) as never,
      ),
    ),
  );
  await flush(60);
  return () => {
    root.unmount();
    host.remove();
  };
}

afterEach(() => {
  doc.body.style.overflow = "";
  doc.body.style.paddingRight = "";
});

describe("写真ビューアのスクロールロック", () => {
  test("スクロールバーが消えた幅を padding で埋め、閉じると元へ戻す", async () => {
    const restore = withScrollbarWidth(15);
    let unmount: (() => void) | undefined;
    try {
      unmount = await mountViewer();
      expect(doc.body.style.overflow).toBe("hidden");
      // 埋めないと本文が15px広がり、閉じた瞬間に戻って横跳ねになる。
      expect(doc.body.style.paddingRight).toBe("15px");
      unmount();
      unmount = undefined;
      await flush(20);
      expect(doc.body.style.paddingRight).toBe("");
      expect(doc.body.style.overflow).toBe("");
    } finally {
      unmount?.();
      restore();
    }
  });

  test("スクロールバーが無いときは何も埋めない", async () => {
    const restore = withScrollbarWidth(0);
    let unmount: (() => void) | undefined;
    try {
      unmount = await mountViewer();
      expect(doc.body.style.paddingRight).toBe("");
    } finally {
      unmount?.();
      restore();
    }
  });

  test("幅がまだ確定していない異常値は埋め物に使わない", async () => {
    // jsdom の clientWidth は既定で0を返す。実ブラウザでも、描画前は
    // 0 が返る環境がある。そのまま使うと innerWidth ぶんの巨大な padding が
    // 入り、元の横跳ねよりひどく崩れる。
    const restore = withScrollbarWidth(dom.window.innerWidth);
    let unmount: (() => void) | undefined;
    try {
      unmount = await mountViewer();
      expect(doc.body.style.paddingRight).toBe("");
    } finally {
      unmount?.();
      restore();
    }
  });
});
