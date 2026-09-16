/**
 * 作品詳細の「中身が出ないとき」を、Series と Work の両方の棚で確かめる。
 *
 * 同じ部品が `/series/:slug` と `/work/:slug` を描く。詳細が届く前・届かな
 * かったときの戻り先が Series に固定されていて、Work の404や通信失敗から
 * シリーズの棚へ案内していた。ここで縛るのは次の5つ。
 *  - 正常: 題名と写真が出て、戻り先は開いた棚
 *  - 404: 「見つかりません」と、開いた棚への戻り先（再読み込みは出さない）
 *  - 通信失敗: 「見つかりません」と言わず、再読み込みと開いた棚への戻り先
 *  - 再読み込みの成功: 同じ画面で中身が出る
 *  - 写真0枚: 通信失敗とは別の「まだ写真がありません」
 */
import { afterEach, describe, expect, test } from "bun:test";
import { canned, flush, setupDom } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Router, Route, Switch } = await import("wouter");
const SeriesDetailPage = (await import("../pages/series-detail")).default;

const doc = dom.window.document;
const cannedFetch = globalThis.fetch;

type Shelf = "series" | "work";
type Reply = "ok" | "empty" | "missing" | "server-error" | "offline";

const detail = (shelf: Shelf, photos: unknown[]) => ({
  series: {
    id: 9,
    slug: "harbour",
    title: shelf === "work" ? "港の仕事" : "港の記録",
    subtitle: "",
    statement: "",
    themeConfig: null,
    kind: shelf,
  },
  photos,
});

const PHOTO = {
  id: 31,
  url: "/api/images/photos/harbour.jpg",
  width: 3200,
  height: 2133,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
  shotAt: "2026-04-01T00:00:00",
  isPublished: true,
};

/** 詳細の応答だけを順番に差し替える。それ以外は共通の canned に任せる。 */
function answerDetail(shelf: Shelf, replies: Reply[]) {
  const calls: Reply[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(raw, "http://localhost/").pathname !== "/api/series/harbour") {
      return cannedFetch(input, init);
    }
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push(reply);
    if (reply === "offline") throw new TypeError("Failed to fetch");
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (reply === "missing") return json(404, { error: "Not found" });
    if (reply === "server-error") return json(500, { error: "Internal server error" });
    return json(200, detail(shelf, reply === "empty" ? [] : [PHOTO]));
  }) as typeof fetch;
  return calls;
}

async function mount(shelf: Shelf) {
  dom.window.history.pushState({}, "", `/${shelf}/harbour`);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        Router,
        null,
        createElement(
          Switch,
          null,
          createElement(Route, { path: "/series/:slug" }, createElement(SeriesDetailPage, null)) as never,
          createElement(Route, { path: "/work/:slug" }, createElement(SeriesDetailPage, null)) as never,
        ),
      ),
    ),
  );
  await flush(200);
  return {
    host,
    backLink: () =>
      Array.from(host.querySelectorAll("a")).find((a) => a.textContent?.startsWith("←")),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  globalThis.fetch = cannedFetch;
  canned["/api/settings"] = {};
  delete canned["/api/series?kind=work"];
});

const SHELVES: { shelf: Shelf; href: string; label: string; noun: string }[] = [
  { shelf: "series", href: "/series", label: "← Series", noun: "シリーズ" },
  // Work の棚の名前は設定で変えられる。戻り先の文字もそれに従う。
  { shelf: "work", href: "/work", label: "← Commissions", noun: "作品" },
];

for (const { shelf, href, label, noun } of SHELVES) {
  describe(`/${shelf}/:slug`, () => {
    const prepare = () => {
      canned["/api/settings"] = { navLabelWork: "Commissions" };
      canned["/api/series?kind=work"] = { series: [] };
    };

    test("正常: 写真を出し、戻り先は開いた棚", async () => {
      prepare();
      answerDetail(shelf, ["ok"]);
      const m = await mount(shelf);
      try {
        expect(m.host.querySelector("h1")?.textContent).toBe(detail(shelf, []).series.title);
        expect(m.host.querySelector('img[src*="harbour"], img[srcset*="harbour"]')).not.toBeNull();
        expect(m.backLink()?.getAttribute("href")).toBe(href);
        expect(m.backLink()?.textContent).toBe(label);
      } finally {
        m.cleanup();
      }
    });

    test("404: 見つからないと伝え、開いた棚へ戻す", async () => {
      prepare();
      answerDetail(shelf, ["missing"]);
      const m = await mount(shelf);
      try {
        expect(m.host.textContent).toContain(`${noun}が見つかりませんでした。`);
        expect(m.host.querySelector('[role="alert"]')).toBeNull();
        expect(m.backLink()?.getAttribute("href")).toBe(href);
        expect(m.backLink()?.textContent).toBe(label);
      } finally {
        m.cleanup();
      }
    });

    for (const failure of ["server-error", "offline"] as const) {
      test(`通信失敗（${failure}）: 見つからないとは言わず、再読み込みと開いた棚を出す`, async () => {
        prepare();
        answerDetail(shelf, [failure]);
        const m = await mount(shelf);
        try {
          expect(m.host.querySelector('[role="alert"]')?.textContent).toContain("読み込めませんでした。");
          expect(m.host.textContent).not.toContain("見つかりませんでした");
          const reload = Array.from(m.host.querySelectorAll("button")).find(
            (b) => b.textContent === "再読み込み",
          );
          expect(reload).toBeDefined();
          expect(m.backLink()?.getAttribute("href")).toBe(href);
          expect(m.backLink()?.textContent).toBe(label);
        } finally {
          m.cleanup();
        }
      });
    }

    test("再読み込みが成功すれば、同じ画面で中身を出す", async () => {
      prepare();
      const calls = answerDetail(shelf, ["offline", "ok"]);
      const m = await mount(shelf);
      try {
        const reload = Array.from(m.host.querySelectorAll("button")).find(
          (b) => b.textContent === "再読み込み",
        );
        reload!.click();
        await flush(200);
        expect(calls).toEqual(["offline", "ok"]);
        expect(m.host.querySelector('[role="alert"]')).toBeNull();
        expect(m.host.querySelector("h1")?.textContent).toBe(detail(shelf, []).series.title);
        expect(m.backLink()?.getAttribute("href")).toBe(href);
      } finally {
        m.cleanup();
      }
    });

    test("写真0枚: 通信失敗ではなく、まだ写真がないと伝える", async () => {
      prepare();
      answerDetail(shelf, ["empty"]);
      const m = await mount(shelf);
      try {
        expect(m.host.textContent).toContain(`この${noun}にはまだ写真がありません`);
        expect(m.host.querySelector('[role="alert"]')).toBeNull();
        expect(m.backLink()?.getAttribute("href")).toBe(href);
      } finally {
        m.cleanup();
      }
    });
  });
}
