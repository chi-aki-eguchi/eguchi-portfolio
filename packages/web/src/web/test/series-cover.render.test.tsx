/**
 * シリーズ詳細の「巻頭」。
 *
 * 詳細ページは紙の上の文字のタイトルから始まり、そのまま写真が延々と続いて
 * いた（`ishigakiisland` は118枚・25,000px）。一方でオーナーが選んだ表紙は
 * 一覧でしか使われず、詳細では一度も出ていなかった。
 *
 * ここで縛るのは5点。
 *  1. 表紙があれば、そこで開く。題名は写真の上に載り、`h1` は1つだけ
 *  2. **表紙が無ければ従来どおり紙の上の題名。** 灰色の空箱を置かない
 *     （`site-and-data-direction.md` §0「0件のときに何が見えるか」）
 *  3. 作家の言葉は、表紙の有無にかかわらず必ず出る
 *  4. **見開きにするのは、選ばれた表紙が1枚目と別の写真のときだけ。**
 *     一覧 API は表紙未設定でも先頭の写真を返すので、それを見開きにすると
 *     同じ写真が表紙と1枚目で2度続いた（/series/sicf、2026-09-15）
 *  5. 見終わったあと、次の組が無くてもプロフィールへ進める
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

const photo = (id: number, url: string, shotAt: string) => ({
  id,
  url,
  width: 2560,
  height: 3200,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
  camera: "PENTAX 67",
  filmType: "フィルム",
  shotAt,
  isPublished: true,
});
const PHOTOS = [
  photo(11, "/api/images/photos/first.jpg", "2025-03-11T00:00:00"),
  photo(12, "/api/images/photos/second.jpg", "2026-08-02T00:00:00"),
];

async function mount({
  cover,
  coverPhotoId = cover ? 12 : null,
  coverUrl = cover ? "/api/images/photos/cover.jpg" : null,
  photos = [],
  settings = {},
}: {
  cover: boolean;
  coverPhotoId?: number | null;
  coverUrl?: string | null;
  photos?: unknown[];
  settings?: Record<string, string>;
}) {
  canned["/api/series/sea"] = { series: SERIES, photos };
  canned["/api/settings"] = settings;
  canned["/api/series"] = {
    series: [
      {
        id: 4,
        slug: "sea",
        title: "海の記憶",
        subtitle: "Sea",
        coverPhotoId,
        coverUrl,
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
  canned["/api/settings"] = {};
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
  test("表紙が未設定で一覧が先頭の写真を代わりに返しても、見開きにせず題名と規模で始める", async () => {
    const m = await mount({
      cover: false,
      coverPhotoId: null,
      coverUrl: PHOTOS[0]!.url,
      photos: PHOTOS,
    });
    try {
      expect(m.host.querySelector(".series-cover")).toBeNull();
      expect(m.host.querySelectorAll("h1").length).toBe(1);
      expect(m.host.querySelector(".series-scale")?.textContent).toBe(
        "2点 ／ 2025年3月–2026年8月",
      );
    } finally {
      m.cleanup();
    }
  });

  test("選んだ表紙が1枚目と同じ写真なら、同じ写真を2度続けない", async () => {
    const m = await mount({
      cover: true,
      coverPhotoId: 11,
      coverUrl: PHOTOS[0]!.url,
      photos: PHOTOS,
    });
    try {
      expect(m.host.querySelector(".series-cover")).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("選んだ表紙が1枚目と別の写真なら見開きで開き、規模の行は重ねない", async () => {
    const m = await mount({
      cover: true,
      coverPhotoId: 12,
      coverUrl: PHOTOS[1]!.url,
      photos: PHOTOS,
    });
    try {
      expect(m.host.querySelector(".series-cover")).not.toBeNull();
      expect(m.host.querySelector(".series-scale")).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("次の組が無くても、見終わったあとプロフィールへ進める", async () => {
    const m = await mount({
      cover: false,
      photos: PHOTOS,
      settings: { profileName: "江口 秋", navLabelAbout: "About" },
    });
    try {
      const nav = m.host.querySelector('nav[aria-label="次に見る"]');
      expect(nav).not.toBeNull();
      const about = nav!.querySelector<HTMLAnchorElement>('a[href="/about"]');
      expect(about?.textContent).toBe("About江口 秋 →");
      // 同じ棚に他の組が無いので「Next」は出さない。
      expect(nav!.textContent).not.toContain("Next");
    } finally {
      m.cleanup();
    }
  });
});
