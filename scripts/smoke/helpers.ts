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
// 「サイト」は公開サイトを大きく見ながら直す画面で、右の欄にページの部分を並べる。
// 以前の左メニューのタブ名で呼べるよう、入口（admin:book:view）と、サイトの
// ページ・一覧・開く部分（admin:site:page / mode / part）へ読み替えて書き、リロードする。
//   gallery  → 写真の詳しい道具（従来の写真一覧）
//   settings → サイトで「トップの見せ方」の節（以前の設定タブの既定の節）
//   そのほか → サイトの編集画面（トップの写真と順番・About・分類・シリーズの詳しい設定…）

/**
 * 以前のタブ名を、管理画面の入口とサイトの画面の状態へ書き込む。
 * `page.addInitScript(storeAdminTab, "setup")` や `page.evaluate(storeAdminTab, tab)` で使う
 * （関数は文字列にして送られるので、外の変数を使わない。読み替えは中に書く）。
 */
export function storeAdminTab(tab: string): void {
  const map: Record<string, { page?: string; mode: string; part: string }> = {
    settings: { page: "top", mode: "page", part: "section:hero" },
    hero: { mode: "more", part: "hero-photos" },
    profile: { page: "about", mode: "page", part: "about" },
    categories: { mode: "more", part: "categories" },
    series: { mode: "more", part: "series-details" },
    pricing: { mode: "more", part: "pricing" },
    service: { mode: "more", part: "service" },
    setup: { mode: "more", part: "setup" },
  };
  if (tab === "gallery") {
    localStorage.setItem("admin:book:view", JSON.stringify("library"));
    return;
  }
  const site = map[tab] ?? map.settings;
  localStorage.setItem("admin:book:view", JSON.stringify("site"));
  if (site.page) localStorage.setItem("admin:site:page", JSON.stringify(site.page));
  localStorage.setItem("admin:site:mode", JSON.stringify(site.mode));
  localStorage.setItem("admin:site:part", JSON.stringify(site.part));
}

export async function gotoAdminTab(page: Page, tab: string, libraryView: "normal" | "select" = "normal"): Promise<void> {
  await page.evaluate(storeAdminTab, tab);
  await page.reload();
  await page.waitForSelector(".admin-screen", { state: "attached", timeout: 10_000 });
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

/** サイトの画面で、右の欄を一覧（探す・部分の一覧）に戻す。 */
export async function backToSiteList(page: Page): Promise<void> {
  if (!(await page.locator(".se-bar").isVisible())) {
    await page.locator(".admin-book__tab", { hasText: "サイト" }).click();
  }
  // 細い画面は「編集／プレビュー」の切り替え。一覧は編集の側にある。
  const edit = page.locator(".admin-settings-mobile-current__view-switch button", { hasText: /^(編集|Edit)$/ });
  if (await edit.isVisible()) await edit.click();
  // 設定の画面は後から読み込まれる。一覧か、開いている部分の「戻る」が出るまで待つ。
  const search = page.locator(".se-search input");
  const back = page.locator(".se-part-head__back, .se-editor-back button");
  await expect(search.or(back).first()).toBeVisible({ timeout: 15_000 });
  if (await back.first().isVisible()) await back.first().click();
  await expect(search).toBeVisible();
}

/**
 * サイトの画面が描かれるまで待つ（開いている部分があればその設定、なければ一覧）。
 * 以前はスマホ幅で目次から中身へ入る手順だった。今は開いた部分がそのまま出る。
 */
export async function revealAdminPanel(page: Page): Promise<void> {
  if (!(await page.locator(".se-bar").isVisible().catch(() => false))) return;
  await page
    .locator(".se-search input, .se-part-head__back, .se-editor-back button")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
}

/**
 * 設定の節を開く。右の欄の「探す」に節の id を入れ、その節を開く行を押す
 * （部分の行も、節を直接開く行も `data-site-sections` に出す節を持つ）。
 */
export async function chooseSettingsSection(page: Page, sectionId: string): Promise<void> {
  await backToSiteList(page);
  const search = page.locator(".se-search input");
  await search.fill(sectionId);
  const row = page.locator(`.se-parts [data-site-sections~="${sectionId}"]`).first();
  await row.click();
  await expect(page.locator(".admin-settings-form-layout")).toBeVisible();
  await expect(page.locator(`[data-settings-section="${sectionId}"]`)).toBeVisible();
}

/** サイトの画面の部分を、ページ（なければ全体の見た目・そのほか）から開く。 */
export async function openSitePart(page: Page, partId: string, where: { page?: string; mode?: "look" | "more" } = { page: "top" }): Promise<void> {
  await backToSiteList(page);
  await page.locator(where.mode ? `[data-site-mode="${where.mode}"]` : `[data-site-page="${where.page}"]`).click();
  await page.locator(`[data-site-part="${partId}"]`).click();
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
