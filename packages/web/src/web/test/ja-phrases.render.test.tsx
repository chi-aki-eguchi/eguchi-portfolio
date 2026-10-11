/**
 * 日本語の文を文節の切れ目でだけ折り返す（JaPhrases）の回帰テスト。
 *
 * 2026-10-01: Safari では `word-break: auto-phrase` が効かず、本番の About・
 * Contact で「デジタ／ル」「コラボレーショ／ン」と語の途中で割れていた。
 * 実際の折り返しは CSS（`.ja-phrases` の keep-all）なので jsdom では測れない。
 * ここで見るのは、折り返してよい所（`<wbr>`）が文節の切れ目にだけ置かれ、
 * 文そのもの（コピー・読み上げ・検索で使う文字）は変わらないこと。
 */
import { test, expect } from "bun:test";
import { setupDom, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { JaPhrases } = await import("../components/JaPhrases");

const doc = dom.window.document;

async function render(text: string) {
  const host = doc.createElement("p");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(JaPhrases, null, text));
  await flush(10);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

test("日本語の文は文節の切れ目にだけ <wbr> を置き、文字は変えない", async () => {
  const text = "撮影依頼・取材・コラボレーションなど、お気軽にご連絡ください。";
  const { host, cleanup } = await render(text);
  try {
    expect(host.textContent).toBe(text);
    expect(host.querySelector(".ja-phrases")).not.toBeNull();
    expect(host.querySelectorAll("wbr").length).toBeGreaterThan(0);
    // 区切った後の各かたまり。語の途中（コラボレーショ／ン など）では切らない。
    const chunks = Array.from(host.querySelector(".ja-phrases")!.childNodes)
      .filter((n) => n.nodeName !== "WBR")
      .map((n) => n.textContent);
    expect(chunks.some((c) => c?.includes("コラボレーション"))).toBe(true);
    expect(chunks.some((c) => c?.includes("ご連絡ください。"))).toBe(true);
  } finally {
    cleanup();
  }
});

test("日本語を含まない文はそのまま（英語のページに余計な要素を足さない）", async () => {
  const text = "For shoot requests, interviews, or collaborations, feel free to get in touch.";
  const { host, cleanup } = await render(text);
  try {
    expect(host.textContent).toBe(text);
    expect(host.querySelector("wbr")).toBeNull();
    expect(host.querySelector(".ja-phrases")).toBeNull();
  } finally {
    cleanup();
  }
});

// Safari の text-wrap: pretty は開き括弧の直後で折るので、短い文節は折らない箱に入れる。
test("短い文節は折らない箱（.ja-phrase）に入り、括弧は次の文節の頭に付く", async () => {
  const { host, cleanup } = await render("非公開にしました（サイトに出ません）");
  try {
    const boxes = Array.from(host.querySelectorAll(".ja-phrase")).map((n) => n.textContent);
    expect(boxes.some((b) => b?.startsWith("（"))).toBe(true);
    expect(boxes.some((b) => b?.endsWith("（"))).toBe(false);
  } finally {
    cleanup();
  }
});

// 本番のスマホで「¥10,／000。」と金額が2行に割れていた（2026-10-12、撮影のご依頼の文）。
test("長い文節の中でも、桁区切りのある数字は折らない箱に入る（文字は変えない）", async () => {
  const text = "ポートレート撮影 60分 ¥10,000。学生の方は半額です。";
  const { host, cleanup } = await render(text);
  try {
    expect(host.textContent).toBe(text);
    const boxes = Array.from(host.querySelectorAll(".ja-phrase")).map((n) => n.textContent);
    expect(boxes).toContain("¥10,000。");
  } finally {
    cleanup();
  }
});
