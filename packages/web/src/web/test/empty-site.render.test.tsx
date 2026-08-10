/**
 * 買った人の初日（まだ何も登録していない状態）の回帰テスト。
 *
 * オーナーのDBは写真で満ちているので、この状態は普段だれも見ない。
 * 2026-08-11 に API の応答を空にして実測したところ、トップページが
 * **1440×540 の空の灰色の四角**だけになっていた。買った直後にいちばん最初に
 * 見る画面がそれだった。
 *
 * ここで縛るのは2点。
 *  1. 読み込みが終わって0枚なら、意味のない箱を置かない
 *  2. **読み込み中は場所を取る**（あとから写真が来て本文が飛ぶのを防ぐ）。
 *     この2つを混ぜると、どちらかを直したときにもう一方が壊れる
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
const TopPage = (await import("../pages/top")).default;

const doc = dom.window.document;
const PLACEHOLDER = "var(--photo-placeholder)";

async function mountTop() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Router, null, createElement(TopPage, null) as never),
    ),
  );
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/photos"] = { photos: [] };
  canned["/api/hero-photos"] = { heroPhotos: [] };
  canned["/api/settings"] = {};
});

describe("何も登録していないサイト", () => {
  test("読み込み後に0枚なら、意味のない灰色の箱を置かない", async () => {
    canned["/api/photos"] = { photos: [] };
    canned["/api/hero-photos"] = { heroPhotos: [] };
    canned["/api/settings"] = {};
    const m = await mountTop();
    try {
      await flush(200);
      expect(
        m.host.innerHTML.includes(PLACEHOLDER),
        "0枚のときに場所取りの箱が残っている",
      ).toBe(false);
      // 作家名は出る（真っ白にはしない）
      expect((m.host.textContent ?? "").trim().length).toBeGreaterThan(0);
    } finally {
      m.cleanup();
    }
  });

  test("読み込み中は場所を取る（写真が来たときに本文が飛ばない）", async () => {
    const m = await mountTop();
    try {
      // fetch が解決する前の最初の描画を見る
      await flush(0);
      expect(
        m.host.innerHTML.includes(PLACEHOLDER),
        "読み込み中に場所を取っていない",
      ).toBe(true);
    } finally {
      m.cleanup();
    }
  });
});
