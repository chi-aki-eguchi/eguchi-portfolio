/**
 * フッターの並べ方（footerLayout）の回帰テスト。
 *
 * フッターは全ページの終わりに必ず出るのに、これまで「中央に積む」の1種類
 * しか無く、買った人全員が同じ終わり方になっていた。
 *
 * 実際の見た目は CSS 側なので jsdom では測れない。ここで見るのは、
 * 選んだ並べ方が枠へ届いていることと、**中身が消えないこと**。
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

const BASE = {
  profileInstagram: "https://example.test/ig",
  profileNote: "https://example.test/note",
  footerText: "© 2026 テスト",
};

async function mountLayout(footerLayout?: string) {
  canned["/api/settings"] = footerLayout
    ? { ...BASE, footerLayout }
    : { ...BASE };
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
    footer: () => host.querySelector("footer"),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
});

describe("フッターの並べ方", () => {
  test("既定は中央に積む", async () => {
    const m = await mountLayout();
    try {
      expect(m.footer()?.getAttribute("data-footer-layout")).toBe("center");
      expect(m.footer()?.innerHTML).toContain("items-center");
    } finally {
      m.cleanup();
    }
  });

  test("left は左寄せ、split は横並びの枠を使う", async () => {
    const left = await mountLayout("left");
    try {
      expect(left.footer()?.getAttribute("data-footer-layout")).toBe("left");
      expect(left.footer()?.innerHTML).toContain("items-start");
    } finally {
      left.cleanup();
    }
    const split = await mountLayout("split");
    try {
      expect(split.footer()?.getAttribute("data-footer-layout")).toBe("split");
      expect(split.footer()?.innerHTML).toContain("md:justify-between");
    } finally {
      split.cleanup();
    }
  });

  test("どの並べ方でも SNS と著作表示が消えない", async () => {
    for (const layout of ["center", "left", "split"]) {
      const m = await mountLayout(layout);
      try {
        const f = m.footer();
        expect(f?.querySelector('nav[aria-label="SNS"]'), layout).not.toBeNull();
        expect(f?.textContent, layout).toContain("© 2026 テスト");
      } finally {
        m.cleanup();
      }
    }
  });

  test("全ページ共通のPrivacy・利用条件への導線がある", async () => {
    const m = await mountLayout();
    try {
      const footer = m.footer();
      expect(footer?.querySelector('a[href="/privacy"]')).not.toBeNull();
      expect(footer?.querySelector('a[href="/terms"]')).not.toBeNull();
      // Portfolio Kit を出していない配布先へ、販売者向けページは露出しない。
      expect(footer?.querySelector('a[href="/legal"]')).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const m = await mountLayout("ドーン");
    try {
      expect(m.footer()?.getAttribute("data-footer-layout")).toBe("center");
    } finally {
      m.cleanup();
    }
  });
});
