/**
 * シリーズ詳細の「巻頭」。
 *
 * 詳細ページは紙の上の文字のタイトルから始まり、そのまま写真が延々と続いて
 * いた（`ishigakiisland` は118枚・25,000px）。一方でオーナーが選んだ表紙は
 * 一覧でしか使われず、詳細では一度も出ていなかった。
 *
 * ここで縛るのは3点。
 *  1. 表紙があれば、そこで開く。題名は写真の上に載り、`h1` は1つだけ
 *  2. **表紙が無ければ従来どおり紙の上の題名。** 灰色の空箱を置かない
 *     （`site-and-data-direction.md` §0「0件のときに何が見えるか」）
 *  3. 作家の言葉は、表紙の有無にかかわらず必ず出る
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router, Route } = await import("wouter");
const SeriesDetailPage = (await import("../pages/series-detail")).default;

const doc = dom.window.document;

const SERIES = {
  id: 4,
  slug: "sea",
  title: "海の記憶",
  subtitle: "Sea",
  statement: "島で撮った三年ぶんの記録。",
  themeConfig: null,
};

async function mount({ cover }: { cover: boolean }) {
  canned["/api/series/sea"] = { series: SERIES, photos: [] };
  canned["/api/series"] = {
    series: [
      {
        id: 4,
        slug: "sea",
        title: "海の記憶",
        subtitle: "Sea",
        coverUrl: cover ? "/api/images/photos/cover.jpg" : null,
        coverRotationDeg: 0,
        coverFocalX: 30,
        coverFocalY: 70,
      },
    ],
  };
  dom.window.history.pushState({}, "", "/series/sea");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      // useParams() only fills in inside a matching Route — mounting the page
      // bare leaves slug empty and the query disabled.
      createElement(
        Router,
        null,
        createElement(Route, { path: "/series/:slug" },
          createElement(SeriesDetailPage, null)) as never,
      ),
    ),
  );
  await flush(200);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  delete canned["/api/series/sea"];
  canned["/api/series"] = { series: [] };
});

describe("シリーズ詳細の巻頭", () => {
  test("表紙があれば、そこで開いて題名を写真の上に載せる", async () => {
    const m = await mount({ cover: true });
    try {
      const cover = m.host.querySelector(".series-cover");
      expect(cover).not.toBeNull();
      const title = cover!.querySelector(".series-cover__title");
      expect(title?.textContent).toBe("海の記憶");
      expect(title?.tagName).toBe("H1");
      // 題名は写真の上に1つだけ。紙の上の見出しと二重に出さない。
      expect(m.host.querySelectorAll("h1").length).toBe(1);
    } finally {
      m.cleanup();
    }
  });

  test("表紙の画像はオーナーが決めた寄せ位置に従い、読み上げからは外す", async () => {
    const m = await mount({ cover: true });
    try {
      const img = m.host.querySelector<HTMLImageElement>(".series-cover__img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("aria-hidden")).toBe("true");
      expect(img!.getAttribute("alt")).toBe("");
      expect(img!.style.objectPosition).toBe("30% 70%");
    } finally {
      m.cleanup();
    }
  });

  test("表紙が無ければ空箱を置かず、紙の上の題名に戻る", async () => {
    const m = await mount({ cover: false });
    try {
      expect(m.host.querySelector(".series-cover")).toBeNull();
      const h1s = m.host.querySelectorAll("h1");
      expect(h1s.length).toBe(1);
      expect(h1s[0]!.textContent).toBe("海の記憶");
    } finally {
      m.cleanup();
    }
  });

  test("作家の言葉は表紙の有無にかかわらず出る", async () => {
    for (const cover of [true, false]) {
      const m = await mount({ cover });
      try {
        expect(`cover=${cover}: ${m.host.textContent?.includes("島で撮った三年ぶんの記録。")}`).toBe(
          `cover=${cover}: true`,
        );
      } finally {
        m.cleanup();
      }
    }
  });
});
