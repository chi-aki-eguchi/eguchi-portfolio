/**
 * TOP の作家ステートメント（homeStatement）の回帰テスト。
 *
 * 写真しか無いトップページはどれも似る。「その人が何を撮っているか」を本人の
 * 文で出せるようにした。**文章は新しく入力させず、Profile の
 * `profileStatement` をそのまま使う**（同じ文を2箇所へ書かせると片方が古くなる）。
 *
 * ここで縛るのは3点。
 *  1. 既定（off）では出ない = 既存のサイトが勝手に変わらない
 *  2. 置き場所（作品の前／後）が効く
 *  3. **ステートメントが空なら、置き場所を指定しても何も出さない**
 *     （見出しだけの空の節を作らない）
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
const STATEMENT = "波のかたちを追いかけて撮っています。";

async function mountTop(settings: Record<string, string> = {}) {
  canned["/api/settings"] = settings;
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
  canned["/api/settings"] = {};
});

describe("TOP の作家の言葉", () => {
  test("既定では出ない（既存のサイトが勝手に変わらない）", async () => {
    const m = await mountTop({ profileStatement: STATEMENT });
    try {
      expect(m.host.textContent).not.toContain(STATEMENT);
    } finally {
      m.cleanup();
    }
  });

  test("置き場所を指定すると出る", async () => {
    for (const at of ["before-works", "after-works"]) {
      const m = await mountTop({
        profileStatement: STATEMENT,
        homeStatement: at,
      });
      try {
        expect(m.host.textContent, at).toContain(STATEMENT);
      } finally {
        m.cleanup();
      }
    }
  });

  test("ステートメントが空なら、指定しても何も出さない", async () => {
    const m = await mountTop({ homeStatement: "before-works" });
    try {
      // 空の節（見出しだけ・中身なし）を作らないこと
      expect(m.host.textContent).not.toContain(STATEMENT);
      const empty = [...m.host.querySelectorAll("section")].filter(
        (s) => !s.textContent?.trim() && !s.querySelector("img"),
      );
      expect(empty.length, "中身の無い節ができている").toBe(0);
    } finally {
      m.cleanup();
    }
  });

  test("知らない値では出さない（DBに変な値が入っても壊さない）", async () => {
    const m = await mountTop({
      profileStatement: STATEMENT,
      homeStatement: "ドーン",
    });
    try {
      expect(m.host.textContent).not.toContain(STATEMENT);
    } finally {
      m.cleanup();
    }
  });
});
