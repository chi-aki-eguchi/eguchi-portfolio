/**
 * お問い合わせフォームの入力エラー文言の回帰テスト。
 *
 * 以前は `validate()` が "Required" / "Invalid" を直に返しており、
 * 日本語のサイトでも英語で出ていた（他の文言はすべて settings か言語ルートで
 * 切り替わるのに、ここだけ切り替わらない）。
 *
 * 色（--form-error）の実際のコントラストは CSS 側なので jsdom では測れない。
 * 実ブラウザでの実測値はコミットメッセージに残してある。
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
const ContactPage = (await import("../pages/contact")).default;

const doc = dom.window.document;

async function mountAndSubmitEmpty(language: "ja" | "en") {
  canned["/api/settings"] = { formspreeUrl: "https://formspree.test/f/abc" };
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
        createElement(ContactPage, { language }) as never,
      ),
    ),
  );
  await flush(120);
  const form = host.querySelector("form");
  form?.dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await flush(120);
  return {
    host,
    alerts: () =>
      [...host.querySelectorAll('[role="alert"]')].map((e) =>
        (e.textContent ?? "").trim(),
      ),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
});

describe("お問い合わせの入力エラー", () => {
  test("日本語のサイトでは日本語で出る", async () => {
    const m = await mountAndSubmitEmpty("ja");
    try {
      const texts = m.alerts();
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.join(" ")).toContain("お名前を入力してください");
      expect(texts.join(" ")).toContain("本文を入力してください");
      // 英語直書きが残っていないこと
      for (const t of texts) {
        expect(t).not.toBe("Required");
        expect(t).not.toBe("Invalid");
      }
    } finally {
      m.cleanup();
    }
  });

  test("英語ページでは英語で出る", async () => {
    const m = await mountAndSubmitEmpty("en");
    try {
      const texts = m.alerts();
      expect(texts.length).toBeGreaterThan(0);
      expect(texts.join(" ")).toContain("Please enter your name");
      expect(texts.join(" ")).not.toContain("お名前");
    } finally {
      m.cleanup();
    }
  });

  test("エラー色は生の Tailwind ではなくトークンを使う", async () => {
    // text-red-600 は暗いテーマで地に対して 4.5:1 に届かない。
    const m = await mountAndSubmitEmpty("ja");
    try {
      expect(m.host.innerHTML).not.toContain("text-red-600");
      expect(m.host.innerHTML).toContain("var(--form-error)");
    } finally {
      m.cleanup();
    }
  });
});
