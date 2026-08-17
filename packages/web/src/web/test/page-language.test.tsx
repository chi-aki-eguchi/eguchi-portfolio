/**
 * 「ヘッダーの JP | EN を押しても、ページの言語の印が変わらない」の回帰テスト。
 *
 * 直接URLで開いた場合はサーバーが正しく出している（`ogp.ts` が `/en/*` で
 * `<html lang="en">` へ差し替える。`ogp.test.ts` が固定済み）。足りないのは
 * **サイト内で切替を押したとき**で、あの切替はページを読み込み直さず中身だけ
 * 差し替えるので、`index.html` の `lang="ja"` が残っていた。読み上げソフトが
 * 英語の本文を日本語の発音で読み、ブラウザの自動翻訳も判断を誤る。
 *
 * 併せて「戻すときに ja と決め打ちしない」ことを縛る。決め打ちだと、英語の
 * 販売ページから英語の About へ移る途中で一度 ja に落ちる。
 */
import { test, expect, describe, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setupDom, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { usePageLanguage } = await import("../hooks/usePageLanguage");

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const doc = dom.window.document;

function Probe({ language }: { language: "ja" | "en" }) {
  usePageLanguage(language);
  return createElement("div", null, language);
}

async function mount(language: "ja" | "en") {
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(StrictMode, null, createElement(Probe, { language })));
  await flush(30);
  return {
    rerender: async (next: "ja" | "en") => {
      root.render(
        createElement(StrictMode, null, createElement(Probe, { language: next })),
      );
      await flush(30);
    },
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  doc.documentElement.lang = "ja";
});

describe("表示中の言語を <html lang> に反映する", () => {
  test("英語ページを開くと en になる", async () => {
    doc.documentElement.lang = "ja";
    const m = await mount("en");
    try {
      expect(doc.documentElement.lang).toBe("en");
    } finally {
      m.cleanup();
    }
  });

  test("切替で ja ⇄ en が追従する", async () => {
    doc.documentElement.lang = "ja";
    const m = await mount("ja");
    try {
      expect(doc.documentElement.lang).toBe("ja");
      await m.rerender("en");
      expect(doc.documentElement.lang).toBe("en");
      await m.rerender("ja");
      expect(doc.documentElement.lang).toBe("ja");
    } finally {
      m.cleanup();
    }
  });

  test("離れるときは、来る前の値へ戻す（ja と決め打ちしない）", async () => {
    // 英語の販売ページに居る状態を作る。
    doc.documentElement.lang = "en";
    const m = await mount("en");
    expect(doc.documentElement.lang).toBe("en");
    m.cleanup();
    await flush(20);
    // 決め打ちで戻す実装だとここが "ja" になる。
    expect(doc.documentElement.lang).toBe("en");
  });
});

describe("配線", () => {
  test("言語を受け取る公開ページは、全部この1つのhookを使う", () => {
    for (const page of [
      "../pages/profile.tsx",
      "../pages/contact.tsx",
      "../pages/service.tsx",
      "../pages/service-start.tsx",
    ]) {
      const s = src(page);
      expect(s, `${page} が usePageLanguage を使っていない`).toContain(
        "usePageLanguage(language)",
      );
      // 各ページで直に触らない。決め打ちの後始末が復活する道を塞ぐ。
      expect(s, `${page} が documentElement.lang を直接触っている`).not.toContain(
        "document.documentElement.lang",
      );
    }
  });
});
