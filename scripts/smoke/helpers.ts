import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

// ── 書き込み事故の番人 ───────────────────────────────────────────────
// 上のコメントは「ログイン以外の非GETは発生しない設計」と言っているだけで、
// 実際に破られていないかを機械的に確かめる仕組みが無かった。ここで見張る。
//
// `loginAsAdmin` を通ったページで、ログイン以外の非GETがネットワークへ出たら
// その要求を止めたうえで記録し、テスト自体を失敗させる。テストを止める前に
// 握りつぶさないよう、afterEach で必ず突き合わせる。
const forbiddenWrites: string[] = [];
const LOGIN_PATH = "/api/admin/login";

// **beforeEach で登録する理由**: Playwright は新しく登録した route を先に見る。
// 各 spec が本文で登録するモック(`page.route`)より後に番人を入れると、番人が
// モック済みの要求まで横取りして止めてしまう(実際に一度そうなった)。
// beforeEach なら番人が最も古いハンドラになり、spec のモックが優先される。
// つまり番人が見るのは「どのモックにも当たらず、本当にサーバーへ出る要求」だけ。
test.beforeEach(async ({ page }) => {
  forbiddenWrites.length = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "GET" || method === "HEAD") {
      await route.fallback();
      return;
    }
    if (new URL(request.url()).pathname === LOGIN_PATH) {
      await route.fallback();
      return;
    }
    forbiddenWrites.push(`${method} ${request.url()}`);
    await route.abort();
  });
});

test.afterEach(() => {
  const seen = forbiddenWrites.splice(0, forbiddenWrites.length);
  expect(
    seen,
    "本番と同じDBにつながっているため、ログイン以外の非GETは1件も許さない",
  ).toEqual([]);
});

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
