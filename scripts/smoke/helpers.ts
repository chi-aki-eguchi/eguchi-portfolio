import { expect, type Page } from "./fixtures.ts";
import { smokeAdminPassword } from "./smoke-env.ts";

// smoke の開発サーバーは、実行ごとの一時SQLite・人工データ・偽ストレージだけに
// つながる（isolated-server.ts、2026-09-17）。本番のDB・保存先・`.env` は使わない。
// それでもテスト同士が共有データを変えないよう、書き込みは fixtures.ts が止める。
// 書き込みを確かめるテストは page.route でモックする。

// Settings の節の数。正本は admin-tabs.tsx の `SETTINGS_SECTION_KEYS` で、
// ここはその写し。**節を足したらここも直す。**
// 以前は 19 という数字が3つの spec に散らばっていて、節を1つ足しただけで
// 4件が同時に落ちた（原因は同じ1箇所なのに、直す場所が4つあった）。
// 写しがずれていないことは packages/web の
// `admin-settings-section-keys.test.ts` が `bun run check` の速さで見張る。
export const SETTINGS_SECTION_COUNT = 21;

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

/** テスト専用のパスワード（playwright.config.ts が実行ごとに作る）。 */
export function getAdminPassword(): string {
  return smokeAdminPassword();
}

export async function loginAsAdmin(page: Page): Promise<void> {
  // 管理画面の明るさ（`useAdminSurface`）は端末ローカルで既定 dark。この
  // スイートの見た目検査の大半は、その機能ができる前の「既定 light」を前提に
  // 値・しきい値を選んでいる。個別テストの意図（暗さそのものの検証）を
  // 混ぜないよう、smoke 全体では明示的に light へ固定する。暗さそのものを
  // 確かめるテストは、ログイン後に自分で "dark"/"site" へ上書きしてよい。
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("admin-surface-preference", "light");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/admin/login");
  await page.locator('input[type="password"]').fill(getAdminPassword());
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector(".admin-atelier", { timeout: 10_000 });
}

// タブは sessionStorage 経由の usePersistentState ではなく localStorage("admin:tab")
// に永続化されているため、直接書き換えてリロードするのが最短経路。
export async function gotoAdminTab(page: Page, tab: string, libraryView: "normal" | "select" = "normal"): Promise<void> {
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
  // Existing detail/reorder scenarios explicitly start in the single-photo view.
  // Tests of the new default selection flow use "select" or open /admin directly.
  if (tab === "gallery") {
    const view = page.locator(`[data-library-mode-action="${libraryView}"]:visible`).first();
    if (await view.isVisible()) await view.click();
    else if (libraryView === "normal") {
      const finish = page.locator(".admin-selection-cancel");
      if (await finish.isVisible()) await finish.click();
    }
  }
}

/** Section navigation keeps the editor wide while its site preview is open. */
export async function chooseSettingsSection(page: Page, sectionId: string): Promise<void> {
  await expect(page.locator(".admin-settings-form-layout")).toBeVisible();
  const toc = page.locator(".studio-editor-outline, .admin-form-toc").filter({has: page.locator("[data-settings-section-link]")}).first();
  const link = toc.locator(`[data-settings-section-link="${sectionId}"]`);
  if (await toc.isVisible()) {
    await link.scrollIntoViewIfNeeded();
    await link.click();
  } else {
    await page.locator(".admin-settings-mobile-current").getByRole("button", { name: /設定項目|Settings list/ }).click();
    await page.locator(`[data-settings-sheet-link="${sectionId}"]`).click();
  }
  await expect(page.locator(`[data-settings-section="${sectionId}"]`)).toBeVisible();
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
