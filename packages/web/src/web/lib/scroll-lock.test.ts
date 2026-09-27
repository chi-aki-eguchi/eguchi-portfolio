/**
 * 開いたメニューの後ろを止める（lockPageScroll）。
 *
 * 2026-09-26 Safari 実測: body を hidden にするとスクロールバーが消えて画面幅が
 * 764px → 768px に変わり、「PC の幅になった」と判定されて開いたメニューが 17ms 後に
 * 閉じていた。写真中心のサイトでは html の overflow-y: scroll のせいで hidden が
 * 効かず、後ろが流れていた。そのときはページをその位置で固定し、閉じたら戻す。
 */
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { JSDOM } from "jsdom";

const { lockPageScroll } = await import("./scroll-lock");

// 全体で流すと、ほかのテストが window / document を差し替えている。このファイル
// 専用の画面を毎回置き、終わったら元へ戻す。
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
const doc = w.document;
const scrolledTo: number[] = [];
w.scrollTo = ((opts: ScrollToOptions) => {
  scrolledTo.push(opts.top ?? -1);
}) as typeof w.scrollTo;
Object.defineProperty(w, "scrollY", { value: 900, configurable: true });

const KEYS = ["window", "document", "getComputedStyle"] as const;
let saved: Record<string, unknown> = {};
beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  saved = Object.fromEntries(KEYS.map((k) => [k, g[k]]));
  Object.assign(g, { window: w, document: doc, getComputedStyle: w.getComputedStyle.bind(w) });
});

afterEach(() => {
  scrolledTo.length = 0;
  doc.body.removeAttribute("style");
  doc.documentElement.removeAttribute("style");
  w.history.replaceState(null, "", "/");
  Object.assign(globalThis, saved);
});

describe("lockPageScroll", () => {
  test("ふつうは body を hidden にするだけで、閉じたら元の値へ戻す", () => {
    doc.body.style.overflow = "clip";
    const unlock = lockPageScroll();
    expect(doc.body.style.overflow).toBe("hidden");
    expect(doc.body.style.position).toBe("");
    unlock();
    expect(doc.body.style.overflow).toBe("clip");
    expect(scrolledTo).toEqual([]);
  });

  test("スクロールバーを残す器では、ページを今の位置で固定し、閉じたら同じ位置へ戻す", () => {
    doc.documentElement.style.overflowY = "scroll";
    const unlock = lockPageScroll();
    expect(doc.body.style.overflow).toBe("hidden");
    expect(doc.body.style.position).toBe("fixed");
    expect(doc.body.style.top).toBe("-900px");
    unlock();
    expect(doc.body.style.position).toBe("");
    expect(doc.body.style.top).toBe("");
    expect(doc.documentElement.style.overflowY).toBe("scroll");
    expect(scrolledTo).toEqual([900]);
  });

  test("メニューから別のページへ移ったときは、前の位置へ戻さない", () => {
    doc.documentElement.style.overflowY = "scroll";
    const unlock = lockPageScroll();
    w.history.pushState(null, "", "/about");
    unlock();
    expect(doc.body.style.position).toBe("");
    expect(scrolledTo).toEqual([]);
  });
});
