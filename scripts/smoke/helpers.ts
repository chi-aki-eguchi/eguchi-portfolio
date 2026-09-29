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
export const SETTINGS_SECTION_COUNT = 25;

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

// 管理画面は、サイトの骨格に関係なく「写真・シリーズ・サイト」の1つの器（2026-09-29）。
// 以前の左メニューのタブ名で呼べるよう、入口（admin:book:view）とサイトの目次の項目
// （admin:book:panel）へ読み替えて localStorage に書き、リロードする。
//   gallery  → 写真の詳しい道具（従来の写真一覧）
//   settings → サイト › トップの見せ方（節は chooseSettingsSection で選ぶ）
//   そのほか → サイト › その編集画面（トップの写真・About・分類・シリーズの詳しい設定…）
export async function gotoAdminTab(page: Page, tab: string, libraryView: "normal" | "select" = "normal"): Promise<void> {
  const view = tab === "gallery" ? "library" : "site";
  await page.evaluate(storeAdminTab, tab);
  await page.reload();
  // スマホ幅のサイトは目次から始まり、中身（.admin-screen）はまだ隠れている。
  await page.waitForSelector(".admin-screen", { state: "attached", timeout: 10_000 });
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading..."), {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.waitForTimeout(300);
  // スマホ幅のサイトは目次と中身を1画面ずつ出す。タブ名で開いたときは中身を出す。
  if (view === "site") await revealAdminPanel(page);
  // Existing detail/reorder scenarios explicitly start in the single-photo view.
  // Tests of the new default selection flow use "select" or open /admin directly.
  if (tab === "gallery") {
    const view = page.locator(`[data-library-mode-action="${libraryView}"]:visible`).first();
    if (await view.isVisible()) await view.click();
    else if (libraryView === "select") {
      // スマホ幅には3つ並ぶ切替が出ない。同じ「選択」へ入る入口は、操作帯の
      // 専用ボタン（`data-library-mobile-select`）になる。ここが押されないまま
      // だったので、スマホの選択の検査は選択に入れずに落ち続けていた。
      const mobileSelect = page
        .locator("[data-library-mobile-select]:visible")
        .first();
      if (await mobileSelect.isVisible()) await mobileSelect.click();
    } else if (libraryView === "normal") {
      const finish = page.locator(".admin-selection-cancel");
      if (await finish.isVisible()) await finish.click();
    }
  }
}

/**
 * 以前のタブ名を、管理画面の入口（admin:book:view）とサイトの目次の項目
 * （admin:book:panel）へ書き込む。`page.addInitScript(storeAdminTab, "setup")` や
 * `page.evaluate(storeAdminTab, tab)` で使う（関数は文字列にして送られるので、
 * 外の変数を使わない）。settings は以前の既定の節（トップの見せ方）。
 */
export function storeAdminTab(tab: string): void {
  const view = tab === "gallery" ? "library" : "site";
  const panel = tab === "gallery" ? null : tab === "settings" ? "settings:hero" : `tab:${tab}`;
  localStorage.setItem("admin:book:view", JSON.stringify(view));
  if (panel) localStorage.setItem("admin:book:panel", JSON.stringify(panel));
}

/** スマホ幅のサイトは目次から始まる。開いている項目の中身へ入る（PC幅では何もしない）。 */
export async function revealAdminPanel(page: Page): Promise<void> {
  const toc = page.locator('.book-site[data-mobile="toc"]');
  if (!(await toc.isVisible().catch(() => false))) return;
  const active = page.locator('.book-site__toc [data-site-item][aria-current="page"]');
  if ((page.viewportSize()?.width ?? 1440) >= 768) return;
  if (await active.count()) await active.first().click();
}

/** サイトの目次から設定の節を開く（スマホ幅は「← サイトの一覧」で目次へ戻ってから）。 */
export async function chooseSettingsSection(page: Page, sectionId: string): Promise<void> {
  const item = page.locator(`[data-site-item="settings:${sectionId}"]`);
  if (!(await item.isVisible())) {
    const back = page.locator(".book-site__back");
    if (await back.isVisible()) await back.click();
    else await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  }
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await expect(page.locator(".admin-settings-form-layout")).toBeVisible();
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
