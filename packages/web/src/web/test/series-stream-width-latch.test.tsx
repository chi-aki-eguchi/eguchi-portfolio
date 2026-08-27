/**
 * TOP のシリーズ帯が「静止モード」に固着しない回帰テスト。
 *
 * 帯は自分の幅を測ってから流れ出す。幅が測れないうちは流さない（並びが
 * 足りず右側が空いたまま動くため）。この待ちを ResizeObserver 1本に任せて
 * いたところ、初回の通知が 0 で届き、そのあと要素の寸法が**変わらない**
 * 環境では二度と呼ばれず、幅 0 のまま固着した。
 *
 * 結果、動きを減らす設定でもない人に静止した帯が出る。2026-08-09 に本番
 * （akieguchi.com）で実際に発生。帯の実寸は 1276px あるのに
 * `series-stream-static` が付いたままで、シリーズ2枚が並ぶだけだった。
 *
 * あわせて「本数が足りないときは流さない」も見張る（2026-08-27）。流すには
 * 同じ並びを繰り返すしかなく、繰り返すと1画面に同じ表紙が何枚も同時に出る。
 * 測れているのに静止する（＝上の事故）と、測れていて本数が足りないから
 * 流さない（＝正しい）は別物なので、クラスで区別する:
 *   - `series-stream-static` … 幅が測れていない／動きを減らす設定
 *   - `series-stream-fits`   … 測れていて、1並びが帯を埋められない
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { SeriesStream } = await import("../components/SeriesStream");

const doc = dom.window.document;

const SERIES = [
  { id: 1, slug: "a", title: "シリーズA", subtitle: "one", coverUrl: "/api/images/a.jpg" },
  { id: 2, slug: "b", title: "シリーズB", subtitle: "two", coverUrl: "/api/images/b.jpg" },
];

/** 帯（1276px）を1並びで越える本数。tileHeight 260 → 1枚 208+28=236px。 */
const MANY_SERIES = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  slug: `s${i}`,
  title: `シリーズ${i}`,
  subtitle: `no.${i}`,
  coverUrl: `/api/images/s${i}.jpg`,
}));

/**
 * 実ブラウザの壊れ方を再現する: 要素は最初から実寸を持っているのに、
 * ResizeObserver は一度も呼ばれない（＝寸法が「変化」しない）。
 */
function silentResizeObserver() {
  const original = (globalThis as Record<string, unknown>).ResizeObserver;
  class Silent {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: Silent });
  Object.assign(dom.window, { ResizeObserver: Silent });
  return () => {
    Object.assign(globalThis, { ResizeObserver: original });
    Object.assign(dom.window, { ResizeObserver: original });
  };
}

/**
 * 帯の実寸だけを `px` にし、`window.innerWidth` は 0 にする。
 *
 * 測る先が「帯そのもの」か「窓」かを、この差で見分ける。旧実装は帯がまだ
 * 描かれていないと `setBandW(window.innerWidth)` へ落ちていたので、窓を 0 に
 * すると静止したままになる。
 */
function withBandWidth(px: number) {
  const proto = dom.window.HTMLElement.prototype;
  const original = proto.getBoundingClientRect;
  const originalInnerWidth = dom.window.innerWidth;
  proto.getBoundingClientRect = function () {
    return {
      x: 0, y: 0, left: 0, top: 0, right: px, bottom: 300,
      width: px, height: 300, toJSON: () => ({}),
    } as DOMRect;
  };
  Object.defineProperty(dom.window, "innerWidth", {
    configurable: true,
    value: 0,
  });
  return () => {
    proto.getBoundingClientRect = original;
    Object.defineProperty(dom.window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  };
}

async function mountStream() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(SeriesStream, {
        label: "Series",
        showCaption: true,
        speedPxPerSec: 34,
        tileHeight: 260,
      }) as never,
    ),
  );
  await flush(120);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/series"] = { series: [] };
});

describe("シリーズ帯の幅の測り直し", () => {
  test("ResizeObserver が一度も鳴かなくても、静止モードに固着しない", async () => {
    canned["/api/series"] = { series: MANY_SERIES };
    const restoreRo = silentResizeObserver();
    const restoreRect = withBandWidth(1276);
    let cleanup: (() => void) | undefined;
    try {
      const mounted = await mountStream();
      cleanup = mounted.cleanup;
      // 保険の再測定（300ms）を越えて待つ
      await flush(500);
      const band = mounted.host.querySelector(".series-stream");
      expect(band).not.toBeNull();
      expect(band!.classList.contains("series-stream-static")).toBe(false);

      const track = band!.querySelector<HTMLElement>(".series-stream-track");
      expect(track).not.toBeNull();
      // 流すときは同じ並びを2つ繋げる。継ぎ目を作らないため、帯より広いこと。
      const items = band!.querySelectorAll(".series-stream-item");
      expect(items.length).toBeGreaterThan(MANY_SERIES.length);
      // 読み上げとTabからは2枚目の写しを外す
      const hidden = [...items].filter(
        (i) => i.getAttribute("aria-hidden") === "true",
      );
      expect(hidden.length).toBe(items.length / 2);
      // 秒数は JS が入れる（幅が測れて初めて決まる）
      expect(track!.style.animationDuration).toMatch(/^[\d.]+s$/);
    } finally {
      cleanup?.();
      restoreRect();
      restoreRo();
    }
  });

  test("本数が帯を埋められないときは流さず、同じ表紙を並べ直さない", async () => {
    canned["/api/series"] = { series: SERIES };
    const restoreRo = silentResizeObserver();
    const restoreRect = withBandWidth(1276);
    let cleanup: (() => void) | undefined;
    try {
      const mounted = await mountStream();
      cleanup = mounted.cleanup;
      await flush(500);
      const band = mounted.host.querySelector(".series-stream");
      expect(band).not.toBeNull();
      // 幅は測れている。だから「測れていない」印は付かない。
      expect(band!.classList.contains("series-stream-static")).toBe(false);
      expect(band!.classList.contains("series-stream-fits")).toBe(true);
      // 1枚も水増ししない
      const items = band!.querySelectorAll(".series-stream-item");
      expect(items.length).toBe(SERIES.length);
      expect(
        [...items].filter((i) => i.getAttribute("aria-hidden") === "true").length,
      ).toBe(0);
      const track = band!.querySelector<HTMLElement>(".series-stream-track");
      expect(track!.style.animationDuration).toBe("");
    } finally {
      cleanup?.();
      restoreRect();
      restoreRo();
    }
  });

  test("幅が最後まで測れないときは流さず、自分で送れる帯にする", async () => {
    canned["/api/series"] = { series: SERIES };
    const restoreRo = silentResizeObserver();
    const restoreRect = withBandWidth(0);
    let cleanup: (() => void) | undefined;
    try {
      const mounted = await mountStream();
      cleanup = mounted.cleanup;
      await flush(500);
      const band = mounted.host.querySelector(".series-stream");
      // 流さない代わりに、横スクロールできる帯として出す（消さない）
      expect(band!.classList.contains("series-stream-static")).toBe(true);
      expect(
        band!.querySelectorAll(".series-stream-item").length,
      ).toBeGreaterThan(0);
    } finally {
      cleanup?.();
      restoreRect();
      restoreRo();
    }
  });
});
