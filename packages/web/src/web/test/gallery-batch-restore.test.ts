/**
 * 戻ったときギャラリーが「どこまで読み込んでいたか」を覚えている（B-18）。
 *
 * スクロール位置だけ覚えても足りない。戻ったページは最初のひと束しか描き
 * 終えていないので、2400px を頼んでも 692px までしか戻れない（2026-08-05 実測）。
 * 束の数も覚えて、描き直してから位置を復元する。
 *
 * ただし覚えた束は**戻ってきたときだけ**使う。前へ進んで入り直したときに
 * 使うと、初めて開いた人と同じ「先頭のひと束から」にならず、いきなり
 * 大量の写真を読みにいってしまう。
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { scrollMemory } from "../lib/scroll-memory";

const GALLERY = "/gallery";

beforeEach(() => {
  scrollMemory.forget(GALLERY);
  scrollMemory.clearRestoring();
});

describe("scrollMemory の束の記憶", () => {
  test("戻ってきたときは覚えていた束を返す", () => {
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.markRestoring(GALLERY);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(5);
  });

  test("前へ進んで来たときは使わない", () => {
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.clearRestoring();
    expect(scrollMemory.peekBatches(GALLERY)).toBe(0);
  });

  // ここが前回この修正が失敗した原因（2026-08-08 実測）。読んだ側で印を
  // 消す作りにすると、StrictMode が useState の初期化関数を2回走らせた
  // とき2回目が 0 を返す。React が採るのは後者なので復元が丸ごと効かず、
  // 497枚まで読み込んで戻っても12枚のままだった。
  test("何度読んでも同じ値を返す（StrictMode の二重呼び出しで消えない）", () => {
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.markRestoring(GALLERY);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(5);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(5);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(5);
  });

  test("印は次の移動で消える（前へ進めば使わなくなる）", () => {
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.markRestoring(GALLERY);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(5);
    scrollMemory.clearRestoring();
    expect(scrollMemory.peekBatches(GALLERY)).toBe(0);
  });

  test("別のページへ戻るときは、そのページの束を他所へ渡さない", () => {
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.markRestoring("/series");
    expect(scrollMemory.peekBatches(GALLERY)).toBe(0);
  });

  test("覚えがないページは 0", () => {
    scrollMemory.markRestoring(GALLERY);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(0);
  });

  test("forget はスクロール位置と束の両方を捨てる", () => {
    scrollMemory.remember(GALLERY, 2400);
    scrollMemory.rememberBatches(GALLERY, 5);
    scrollMemory.forget(GALLERY);
    scrollMemory.markRestoring(GALLERY);
    expect(scrollMemory.get(GALLERY)).toBe(0);
    expect(scrollMemory.peekBatches(GALLERY)).toBe(0);
  });
});

describe("呼び出し側の配線", () => {
  const src = (p: string) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").readFileSync(
      new URL(p, import.meta.url).pathname,
      "utf8",
    ) as string;

  test("PageTransition は復元へ入る前に印を付ける", () => {
    const s = src("../components/PageTransition.tsx");
    // markRestoring は setDisplay より先。戻り先はその直後にマウントして
    // 自分で受け取りにくるため、順番が逆だと間に合わない。
    expect(s.indexOf("scrollMemory.markRestoring")).toBeLessThan(
      s.indexOf("setDisplay(newChildren)"),
    );
    expect(s).toContain("scrollMemory.clearRestoring()");
  });

  test("本物の戻るを、パスの比較で捨てない", () => {
    const pt = src("../components/PageTransition.tsx");
    const lb = src("../components/Lightbox.tsx");
    // 実ブラウザでは popstate が届いた時点で wouter が先に location を
    // 更新し終えており、本物の戻るも「同じパスへの pop」に見える。パスを
    // 見比べて捨てると本物まで無視され、戻ってもスクロール位置も読み込み
    // 済みの枚数も復元されない（2026-08-08 実測）。
    expect(pt).not.toContain("window.location.pathname === prevLocation.current");
    expect(pt).toContain("historyBridge.consumeSelfPop()");
    // 印を立てるのは、自分で history.back() を呼ぶビューア側の責任。
    expect(lb).toContain("historyBridge.markSelfPop()");
    expect(lb.indexOf("historyBridge.markSelfPop()")).toBeLessThan(
      lb.indexOf("window.history.back()"),
    );
  });

  test("ギャラリーの絞り込みリセットはマウント時に走らない", () => {
    const s = src("../pages/gallery.tsx");
    // 初回に走ると、復元した束をその場で 0 へ潰してしまう。
    expect(s).toContain("prevFilterKey");
    const reset = s.slice(
      s.indexOf("const prevFilterKey"),
      s.indexOf("}, [activeFilter, activeMedium]);"),
    );
    expect(reset).toContain("if (prevFilterKey.current === null)");
    expect(reset.indexOf("prevFilterKey.current === null")).toBeLessThan(
      reset.indexOf("setExtraCount(0)"),
    );
  });

  test("ギャラリーは束を覚え、マウント時に受け取る", () => {
    const s = src("../pages/gallery.tsx");
    expect(s).toContain("scrollMemory.peekBatches(location)");
    expect(s).toContain("scrollMemory.rememberBatches(location, extraCount)");
  });
});
