/**
 * 各ページの見出しの型（pageTitleStyle）の回帰テスト。
 *
 * どのページも「小さな大文字の英単語が1つ中央にある」ところから始まるのが、
 * このKitのいちばん強い型だった。写真も色も書体も変えたサイト同士でも、
 * 出だしが同じなので同じテンプレートだと分かってしまう。
 *
 * ここで縛るのは次の3点。
 *  1. 既定（label）は従来どおり小さな大文字・中央
 *  2. **hidden でも見出し要素を消さない**（読み上げの目印を失わせない）
 *  3. Contact は自分の構成に見出しを合わせる（align の上書きが効く）
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
const { PageTitle } = await import("../components/PageTitle");

const doc = dom.window.document;

async function mountTitle(
  pageTitleStyle?: string,
  props: Record<string, unknown> = {},
) {
  canned["/api/settings"] = pageTitleStyle ? { pageTitleStyle } : {};
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
        createElement(PageTitle, props as never, "Gallery") as never,
      ),
    ),
  );
  await flush(120);
  return {
    host,
    h1: () => host.querySelector("h1"),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
});

describe("ページ見出しの型", () => {
  test("既定は小さな大文字・中央", async () => {
    const m = await mountTitle();
    try {
      const h1 = m.h1();
      expect(h1?.className).toContain("uppercase");
      expect(h1?.className).toContain("text-center");
      expect(h1?.className).not.toContain("sr-only");
      expect(h1?.textContent).toBe("Gallery");
    } finally {
      m.cleanup();
    }
  });

  test("left は中央揃えをやめる", async () => {
    const m = await mountTitle("left");
    try {
      expect(m.h1()?.className).toContain("uppercase");
      expect(m.h1()?.className).not.toContain("text-center");
    } finally {
      m.cleanup();
    }
  });

  test("display は大文字にせず、見出しの大きさで出す", async () => {
    const m = await mountTitle("display");
    try {
      const h1 = m.h1();
      expect(h1?.className).not.toContain("uppercase");
      expect(h1?.getAttribute("style") ?? "").toContain("--heading-size");
    } finally {
      m.cleanup();
    }
  });

  test("hidden でも見出しは消さない（読み上げのために残す）", async () => {
    const m = await mountTitle("hidden");
    try {
      const h1 = m.h1();
      expect(h1, "h1 自体は残る").not.toBeNull();
      expect(h1?.className).toContain("sr-only");
      expect(h1?.textContent).toBe("Gallery");
    } finally {
      m.cleanup();
    }
  });

  test("align を渡したページは、そちらが優先される（Contact の構成）", async () => {
    const m = await mountTitle("label", { align: "left" });
    try {
      expect(m.h1()?.className).not.toContain("text-center");
    } finally {
      m.cleanup();
    }
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const m = await mountTitle("ドーン");
    try {
      expect(m.h1()?.className).toContain("text-center");
    } finally {
      m.cleanup();
    }
  });
});
