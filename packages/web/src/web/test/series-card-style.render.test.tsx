/**
 * シリーズ一覧の札（seriesCardStyle）の回帰テスト。
 *
 * 作品群の入口はサイトの印象を強く決めるのに、これまで「4:5の表紙 + 下に題名」の
 * 1種類しか無く、買った人全員が同じ見え方になっていた。
 *
 * ここで縛るのは次の3点。
 *  1. 既定（caption）は従来どおり
 *  2. overlay で題名が二重に出ないこと（上に載せたら下には出さない）
 *  3. **表紙が無いシリーズで空の四角を置かないこと**。題名を出す
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
const { SeriesGrid } = await import("../components/SeriesGrid");

const doc = dom.window.document;

const WITH_COVER = {
  id: 1,
  slug: "sea",
  title: "海の記憶",
  subtitle: "Sea",
  coverUrl: "https://example.test/cover.jpg",
};
const NO_COVER = {
  id: 2,
  slug: "town",
  title: "町の呼吸",
  subtitle: null,
  coverUrl: null,
};

async function mountGrid(cardStyle?: string, series = [WITH_COVER, NO_COVER]) {
  canned["/api/settings"] = cardStyle ? { seriesCardStyle: cardStyle } : {};
  canned["/api/series"] = { series };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Router, null, createElement(SeriesGrid, null) as never),
    ),
  );
  await flush(140);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
  canned["/api/series"] = { series: [] };
});

describe("シリーズ一覧の札", () => {
  test("既定は 4:5 の表紙の下に題名", async () => {
    const m = await mountGrid();
    try {
      expect(m.host.innerHTML).toContain("aspect-[4/5]");
      expect(m.host.innerHTML).not.toContain("aspect-[3/2]");
      expect(m.host.textContent).toContain("海の記憶");
    } finally {
      m.cleanup();
    }
  });

  test("wide は 3:2 の横長になる", async () => {
    const m = await mountGrid("wide");
    try {
      expect(m.host.innerHTML).toContain("aspect-[3/2]");
      expect(m.host.innerHTML).not.toContain("aspect-[4/5]");
    } finally {
      m.cleanup();
    }
  });

  test("overlay でも題名は1回だけ（上に載せたら下には出さない）", async () => {
    const m = await mountGrid("overlay", [WITH_COVER]);
    try {
      const hits = (m.host.textContent ?? "").split("海の記憶").length - 1;
      expect(hits, "題名が二重に出ている").toBe(1);
      const subs = (m.host.textContent ?? "").split("Sea").length - 1;
      expect(subs).toBe(1);
    } finally {
      m.cleanup();
    }
  });

  test("表紙が無いシリーズは、空の四角ではなく題名を出す", async () => {
    for (const style of ["caption", "overlay", "wide"]) {
      const m = await mountGrid(style, [NO_COVER]);
      try {
        expect(m.host.querySelector("img"), `${style}: 画像は無い`).toBeNull();
        expect(m.host.textContent, `${style}: 題名が要る`).toContain("町の呼吸");
      } finally {
        m.cleanup();
      }
    }
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const m = await mountGrid("ドーン");
    try {
      expect(m.host.innerHTML).toContain("aspect-[4/5]");
    } finally {
      m.cleanup();
    }
  });
});
