/**
 * ページ最上部のヘッダーの地（headerBackground）の回帰テスト。
 *
 * オーナー依頼（2026-08-09）「上の帯の白を無くす。文字だけ・薄いフェードも
 * 選べるように」。
 *
 * ここで縛るのは**地を透かすときの土台**。地を transparent にするだけでは
 * 帯は消えない。裏が本文の余白なら同じ色の帯が残るだけなので、透かすときは
 * 全画面HEROを header の下まで伸ばす必要がある。その入口になる印
 * （`.header-see-through` と `.site-main`）が付いていることを見る。
 *
 * 実際の色や余白は CSS 側なので jsdom では測れない。実ブラウザでの見え方は
 * `docs/archive/task-handoffs.md` の 2026-08-09 の節に実測を残してある。
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
const Layout = (await import("../components/Layout")).default;

const doc = dom.window.document;

async function mountLayout(headerBackground?: string) {
  canned["/api/settings"] =
    headerBackground === undefined ? {} : { headerBackground };
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
        createElement(Layout, null, createElement("div", null, "page")) as never,
      ),
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
  canned["/api/settings"] = {};
});

describe("ヘッダーの地", () => {
  test("既定は今までどおり地を塗る", async () => {
    const { host, cleanup } = await mountLayout();
    try {
      expect(host.querySelector(".header-see-through")).toBeNull();
      const header = host.querySelector("header");
      expect(header?.className).toContain("bg-[var(--background)]");
      expect(header?.className).not.toContain("site-header-see-through");
      expect(header?.getAttribute("data-header-bg")).toBe("solid");
    } finally {
      cleanup();
    }
  });

  for (const mode of ["fade", "none"] as const) {
    test(`${mode} は地を透かし、HEROを伸ばす印を付ける`, async () => {
      const { host, cleanup } = await mountLayout(mode);
      try {
        // 全画面HEROを header の下まで伸ばす CSS の入口
        expect(host.querySelector(".header-see-through")).not.toBeNull();
        const header = host.querySelector("header");
        expect(header?.className).toContain("site-header-see-through");
        expect(header?.className).not.toContain("bg-[var(--background)]");
        expect(header?.getAttribute("data-header-bg")).toBe(mode);
      } finally {
        cleanup();
      }
    });
  }

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const { host, cleanup } = await mountLayout("ハデハデ");
    try {
      expect(host.querySelector(".header-see-through")).toBeNull();
      expect(host.querySelector("header")?.getAttribute("data-header-bg")).toBe(
        "solid",
      );
    } finally {
      cleanup();
    }
  });

  test("本文の上余白は CSS が持つ（インラインで書かない）", async () => {
    // インラインだと、透かしたとき「全画面HEROだけ header の下へ」の
    // 上書きが常に負ける。実際それで一度効かなかった。
    const { host, cleanup } = await mountLayout("none");
    try {
      const main = host.querySelector("main");
      expect(main?.className).toContain("site-main");
      expect(main?.getAttribute("style") ?? "").not.toContain("padding-top");
    } finally {
      cleanup();
    }
  });
});
