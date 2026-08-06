/**
 * Lightbox のスワイプ回帰テスト。
 *
 * 指を離すと、ブラウザは touchend のあとに click も作る。スワイプで移動した
 * 直後に、その click が左右28%の送り戻し領域に当たると、1回のスワイプで2回
 * 動いてしまう（左スワイプなら「次へ」→「前へ」で、その場に戻る）。
 * ズーム中のドラッグには抑止があるが、等倍のスワイプには無かった。
 */
import { test, expect, describe } from "bun:test";
import { setupDom, samplePhotos, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);

const BOX = 1000;

/** 写真が画面いっぱいに表示されている状態を作る（jsdom は寸法を持たない）。 */
function stubLayout() {
  const proto = dom.window.HTMLImageElement.prototype;
  for (const [name, value] of [
    ["naturalWidth", BOX],
    ["naturalHeight", BOX],
  ] as const) {
    Object.defineProperty(proto, name, { configurable: true, get: () => value });
  }
  dom.window.HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: BOX,
      height: BOX,
      right: BOX,
      bottom: BOX,
      toJSON: () => ({}),
    }) as DOMRect;
}

async function mountViewer() {
  const moves: string[] = [];
  const photos = samplePhotos.map((p) => ({
    url: p.url,
    title: p.title,
    camera: p.camera,
    lens: p.lens,
    filmType: p.filmType,
  }));
  const { Lightbox } = await import("../components/Lightbox");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
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
          onClose: () => moves.push("close"),
          onPrev: () => moves.push("prev"),
          onNext: () => moves.push("next"),
        }) as never,
      ),
    ),
  );
  await flush(120);
  const dlg = dom.window.document.querySelector("dialog");
  if (!dlg) throw new Error("dialog did not mount");
  return {
    moves,
    dlg,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

type Point = { x: number; y: number };

function touch(target: EventTarget, x: number, y: number) {
  return { identifier: 1, target, clientX: x, clientY: y } as unknown as Touch;
}

/** 実機と同じ順序で指の操作を再現する: pointer → touch → 合成click。 */
function swipe(dlg: Element, from: Point, to: Point) {
  const opts = { bubbles: true, cancelable: true };
  const pointer = (type: string, p: Point) =>
    dlg.dispatchEvent(
      new dom.window.PointerEvent(type, {
        ...opts,
        pointerId: 1,
        pointerType: "touch",
        clientX: p.x,
        clientY: p.y,
      }),
    );

  pointer("pointerdown", from);
  dlg.dispatchEvent(
    new dom.window.TouchEvent("touchstart", {
      ...opts,
      touches: [touch(dlg, from.x, from.y)],
    }),
  );
  pointer("pointermove", to);
  pointer("pointerup", to);
  dlg.dispatchEvent(
    new dom.window.TouchEvent("touchend", {
      ...opts,
      changedTouches: [touch(dlg, to.x, to.y)],
    }),
  );
  // 指を離したあとにブラウザが作る click。押した場所ではなく離した場所に出る。
  const image = dlg.querySelector("img") ?? dlg;
  image.dispatchEvent(
    new dom.window.MouseEvent("click", {
      ...opts,
      detail: 1,
      clientX: to.x,
      clientY: to.y,
    }),
  );
}

describe("Lightbox swipe", () => {
  test("one swipe moves exactly one photo", async () => {
    stubLayout();
    const { moves, dlg, cleanup } = await mountViewer();
    try {
      // 右から左へ。指は左端(送り戻し領域)で離れる。
      swipe(dlg, { x: 820, y: 500 }, { x: 90, y: 505 });
      await flush(5);
      expect(moves).toEqual(["next"]);
    } finally {
      cleanup();
    }
  });

  test("a swipe the other way also moves exactly one photo", async () => {
    stubLayout();
    const { moves, dlg, cleanup } = await mountViewer();
    try {
      swipe(dlg, { x: 90, y: 500 }, { x: 820, y: 495 });
      await flush(5);
      expect(moves).toEqual(["prev"]);
    } finally {
      cleanup();
    }
  });

  test("a tap near the edge still navigates — suppression is not sticky", async () => {
    stubLayout();
    const { moves, dlg, cleanup } = await mountViewer();
    try {
      swipe(dlg, { x: 820, y: 500 }, { x: 90, y: 505 });
      await flush(5);
      // 続けて、動かさずに右端を叩く。前のスワイプの抑止が残っていると無反応になる。
      swipe(dlg, { x: 900, y: 500 }, { x: 900, y: 500 });
      await flush(5);
      expect(moves).toEqual(["next", "next"]);
    } finally {
      cleanup();
    }
  });
});
