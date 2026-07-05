import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

// 【重要】この開発環境(bun run dev / bun run smoke)は本番と同じTursoデータベースに
// 直接つながっている(ステージングDB分離なし)。スモークテストを追加する時は、
// Save/Delete/Add確定などデータを実際に書き込む操作をクリックしないこと
// (ローカルstateの変更・discard・確認ダイアログのキャンセルまでに留める)。
// どうしても書き込みが必要な場合は、テスト終了時に必ず自分でデータを削除する
// teardownを書くこと。現状の全スペックはログイン(セッションCookie発行のみ)以外
// 非GETリクエストを一切発生させない設計(findings.md「検証用DB分離」参照)。

// 9タブ全て(setup=はじめに含む)。追加/削除時はここを更新する。
export const ADMIN_TABS = [
  "setup",
  "gallery",
  "hero",
  "profile",
  "categories",
  "series",
  "pricing",
  "service",
  "settings",
] as const;

export function getAdminPassword(): string {
  const envPath = path.resolve(__dirname, "../../.env");
  const text = fs.readFileSync(envPath, "utf8");
  const m = text.match(/^ADMIN_PASSWORD=(.*)$/m);
  if (!m || !m[1].trim()) {
    throw new Error(
      "ADMIN_PASSWORD が .env に設定されていません。スモークテストには管理画面ログインが必要です。",
    );
  }
  return m[1].trim();
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.locator('input[type="password"]').fill(getAdminPassword());
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector(".admin-atelier", { timeout: 10_000 });
}

// タブは sessionStorage 経由の usePersistentState ではなく localStorage("admin:tab")
// に永続化されているため、直接書き換えてリロードするのが最短経路。
export async function gotoAdminTab(page: Page, tab: string): Promise<void> {
  await page.evaluate(
    (t) => localStorage.setItem("admin:tab", JSON.stringify(t)),
    tab,
  );
  await page.reload();
  await page.waitForSelector(".admin-screen", { timeout: 10_000 });
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading..."), {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
}

export type ScrollProbe = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

// .admin-content 配下で実際にオーバーフローしているスクロールコンテナを1つ探す。
// 無ければ null(=このタブ/画面幅では現在オーバーフローするコンテンツがない)。
export async function findScrollableInContent(
  page: Page,
): Promise<ScrollProbe | null> {
  return page.evaluate(() => {
    const el = Array.from(document.querySelectorAll(".admin-content *")).find(
      (e) => {
        const cs = getComputedStyle(e);
        return (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          e.scrollHeight > e.clientHeight + 5
        );
      },
    ) as HTMLElement | undefined;
    return el
      ? {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }
      : null;
  });
}

export async function scrollContentToBottom(
  page: Page,
): Promise<number | null> {
  return page.evaluate(() => {
    const el = Array.from(document.querySelectorAll(".admin-content *")).find(
      (e) => {
        const cs = getComputedStyle(e);
        return (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          e.scrollHeight > e.clientHeight + 5
        );
      },
    ) as HTMLElement | undefined;
    if (!el) return null;
    el.scrollTo(0, el.scrollHeight);
    return el.scrollTop;
  });
}
