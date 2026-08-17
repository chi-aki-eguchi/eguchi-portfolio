/**
 * 「読み込み中に矢印キーを押すと、トップの大きな写真が出なくなる」の回帰テスト。
 *
 * カルーセルは何枚目かを `(c + 1) % photos.length` で数える。写真がまだ届いて
 * いない間は割る数が0なので、**結果は NaN になる。** `current` を正常値へ戻す
 * 処理はどこにも無いので、そのあと写真が届いても `i === current` がどの枚にも
 * 当たらず、`active` が付いたスライドが1枚も無い状態で固まる。見えるのは
 * 「トップの写真が出ない」で、その訪問中は再読み込みするまで直らない。
 *
 * クリック・矢印ボタン・点の3経路には「2枚以上のとき」の守りがあったが、
 * キーボードだけ素通しだった。守りは goNext / goPrev の側に置いてある。
 * ここでは**キーボードから入った場合**を測る。
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

const w = dom.window;
const doc = w.document;

const HERO = [
  { url: "/api/images/photos/h1.jpg", title: "H1" },
  { url: "/api/images/photos/h2.jpg", title: "H2" },
  { url: "/api/images/photos/h3.jpg", title: "H3" },
];

/** hero-photos だけ遅らせて、「まだ0枚」の窓を作る。 */
function withSlowHeroFetch(delayMs: number) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const path = new URL(raw, "http://localhost/").pathname;
    if (path === "/api/hero-photos") {
      await new Promise((r) => setTimeout(r, delayMs));
      return new Response(JSON.stringify({ heroPhotos: HERO }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return original(input as Parameters<typeof fetch>[0]);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

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

function press(key: string) {
  w.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true }));
}

// `canned` は全テストファイルで共有される1つのオブジェクトである。
// **既定値へ戻すのではなく、触る前の姿へ戻す。** 「空にして返す」afterEach を
// 書いたところ、あとから走る admin / レイアウトのテスト26件が写真0枚の世界を
// 見て落ちた。ファイルの実行順に依存する壊れ方なので、単体で走らせている間は
// 気づけない（2026-08-17 実測）。
let cannedSnapshot: Record<string, unknown> = {};

beforeEach(() => {
  cannedSnapshot = { ...canned };
});

afterEach(() => {
  for (const key of Object.keys(canned)) delete canned[key];
  Object.assign(canned, cannedSnapshot);
  doc.body.style.overflow = "";
});

describe("読み込み中の矢印キー", () => {
  test.each(["ArrowRight", "ArrowLeft"] as const)(
    "%s を写真が届く前に押しても、届いたあと1枚目が出る",
    async (key) => {
      canned["/api/settings"] = {};
      canned["/api/photos"] = { photos: [] };
      const restore = withSlowHeroFetch(120);
      const m = await mountTop();
      try {
        // まだ hero-photos は届いていない。ここで押す。
        await flush(20);
        press(key);
        press(key);

        // 写真が届いたあと。
        await flush(500);

        const slides = m.host.querySelectorAll(".hero-slide");
        expect(slides.length, "スライドが描かれていない").toBe(HERO.length);
        // `active` がどこにも付いていない ＝ 何も見えていない状態。
        const active = m.host.querySelectorAll(".hero-slide.active");
        expect(active.length, "表示中のスライドが1枚に定まっていない").toBe(1);
      } finally {
        m.cleanup();
        restore();
      }
    },
  );

  test("写真が届いたあとは、矢印キーで実際に送れる", async () => {
    canned["/api/settings"] = {};
    canned["/api/photos"] = { photos: [] };
    canned["/api/hero-photos"] = { heroPhotos: HERO };
    const m = await mountTop();
    try {
      await flush(200);
      const indexOfActive = () => {
        const all = [...m.host.querySelectorAll(".hero-slide")];
        return all.findIndex((el) => el.classList.contains("active"));
      };
      expect(indexOfActive()).toBe(0);

      press("ArrowRight");
      await flush(60);
      expect(indexOfActive()).toBe(1);

      press("ArrowLeft");
      await flush(60);
      expect(indexOfActive()).toBe(0);
    } finally {
      m.cleanup();
    }
  });
});
