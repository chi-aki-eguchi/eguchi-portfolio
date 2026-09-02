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
import { test, expect, describe, afterEach, beforeEach } from "bun:test";
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

// `canned` は全テストファイルで共有される1つのオブジェクト。既定値へ戻すのでは
// なく、触る前の姿へ戻す。空にして返す afterEach は、あとから走るテストを
// 実行順まかせで落とす（2026-08-17 に26件で実測）。
let cannedSnapshot: Record<string, unknown> = {};

beforeEach(() => {
  cannedSnapshot = { ...canned };
});

afterEach(() => {
  for (const key of Object.keys(canned)) delete canned[key];
  Object.assign(canned, cannedSnapshot);
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
      expect(
        m.host.querySelector(".hero-carousel-contain"),
        "読み込み中だけ別の60vh箱になり、写真到着時に高さが跳ねる",
      ).not.toBeNull();
    } finally {
      m.cleanup();
    }
  });
});

/** 5種類すべてを同じ基準で測る。既定のカルーセルだけ見ていたので、
 *  静謐グリッド・エディトリアル・没入型の3種が長く見落とされていた。 */
const HERO_MODES: string[] = [
  "carousel",
  "single",
  "quiet-grid",
  "editorial",
  "immersive",
];

/** 意味のない箱を見分ける。テーマに従う場所取り色と、決め打ちの色の両方。 */
const BOX_MARKERS = [PLACEHOLDER, "#2a3a3a", "bg-[#"];

describe("HERO の見せ方5種すべてで、0枚のときに箱を置かない", () => {
  test.each(HERO_MODES)("heroMode=%s", async (heroMode) => {
    canned["/api/photos"] = { photos: [] };
    canned["/api/hero-photos"] = { heroPhotos: [] };
    canned["/api/settings"] = { heroMode };
    const m = await mountTop();
    try {
      await flush(250);
      const html = m.host.innerHTML;
      for (const marker of BOX_MARKERS) {
        expect(
          html.includes(marker),
          `heroMode=${heroMode} に ${marker} の箱が残っている`,
        ).toBe(false);
      }
      // 真っ白にはしない。誰のサイトかは分かる。
      expect(
        (m.host.textContent ?? "").trim().length,
        `heroMode=${heroMode} で名前が出ていない`,
      ).toBeGreaterThan(0);
    } finally {
      m.cleanup();
    }
  });

  test.each(HERO_MODES)(
    "heroMode=%s は読み込み中だけ場所を取る",
    async (heroMode) => {
      canned["/api/settings"] = { heroMode };
      const m = await mountTop();
      try {
        await flush(0);
        expect(
          m.host.innerHTML.includes(PLACEHOLDER),
          `heroMode=${heroMode} が読み込み中に場所を取っていない`,
        ).toBe(true);
      } finally {
        m.cleanup();
      }
    },
  );
});
