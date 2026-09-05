import { expect, test } from "@playwright/test";
import { gotoAdminTab, loginAsAdmin } from "./helpers";

const WORKSPACE_PHOTO = {
  id: 6_200_001,
  filename: "workspace.jpg",
  url: "/api/images/workspace/original.jpg",
  thumbUrl: "/api/images/workspace/thumb.jpg",
  mediumUrl: "/api/images/workspace/medium.jpg",
  title: "Workspace photo",
  meta: "",
  description: "",
  category: null,
  camera: null,
  lens: null,
  focalLength: null,
  fNumber: null,
  exposureTime: null,
  iso: null,
  filmType: "デジタル",
  shotAt: null,
  displaySize: "M",
  width: 1200,
  height: 800,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
  sortOrder: 0,
  seriesId: null,
  isPublished: true,
  fileHash: null,
  deletedAt: null,
  createdAt: "2026-07-29T00:00:00.000Z",
};

test.describe("admin — Workspace layout", () => {
  test("1024pxでは64pxナビと900px以上のLibrary作業面を保つ", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopで1024pxを確認する");
    await page.setViewportSize({ width: 1024, height: 900 });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const sidebar = page.locator(".admin-sidebar");
    const main = page.locator(".admin-main");
    const workspace = page.locator('[data-admin-workspace="library"]');
    const [sidebarBox, mainBox, workspaceBox] = await Promise.all([
      sidebar.boundingBox(),
      main.boundingBox(),
      workspace.boundingBox(),
    ]);
    expect(sidebarBox?.width).toBeCloseTo(64, 0);
    expect(mainBox?.width ?? 0).toBeGreaterThanOrEqual(900);
    expect(workspaceBox?.width).toBeCloseTo(mainBox?.width ?? 0, 0);
    await expect(
      sidebar.locator('[data-compact-sidebar-group="photos"]'),
    ).toBeVisible();
    await expect(sidebar.locator(".admin-sidebar__tab").first()).toBeHidden();

    const presentation = sidebar.locator(
      '[data-compact-sidebar-group="presentation"]',
    );
    await presentation.focus();
    await presentation.press("ArrowRight");
    const popover = sidebar.locator(
      '[data-compact-sidebar-popover="presentation"]',
    );
    await expect(popover).toBeVisible();
    const popoverItems = popover.locator("[data-compact-sidebar-item]");
    await expect(popoverItems.first()).toBeFocused();
    await popoverItems.first().press("ArrowDown");
    await expect(popoverItems.nth(1)).toBeFocused();
    await popoverItems.nth(1).press("Escape");
    await expect(presentation).toBeFocused();

    await expect(page.locator("[data-library-mode-switcher]")).toHaveCount(1);
    await expect(page.locator("[data-library-search-input]")).toBeVisible();
    await expect(page.locator("[data-library-filters-toggle]")).toBeVisible();
    const viewMenu = page.locator(".admin-library-view-menu > summary");
    await expect(viewMenu).toBeVisible();
    await expect(page.getByRole("button", { name: "表形式" })).toBeHidden();
    await viewMenu.click();
    await expect(page.getByRole("button", { name: "表形式" })).toBeVisible();
    // 取り込み一式は見出しではなく作業バーの右端にある(2026-07-31 刷新)。
    const importGroup = page.locator("[data-library-exit-actions]");
    await expect(importGroup).toBeVisible();
    await expect(importGroup.locator("fieldset")).toBeVisible();
    await expect(
      importGroup.locator(".admin-library-import-button"),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("広い画面では畳み状態を保存し、詳細欄を400pxで右に並べる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopで1440pxを確認する");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/photos?**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ photos: [WORKSPACE_PHOTO] }),
      }),
    );
    await page.route("**/api/images/workspace/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([]),
      }),
    );
    await loginAsAdmin(page);
    await page.evaluate(() =>
      localStorage.removeItem("admin:sidebarCollapsed"),
    );
    await page.reload();
    await gotoAdminTab(page, "gallery");

    const sidebar = page.locator(".admin-sidebar");
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(248, 0);
    await page.locator("[data-sidebar-collapse]").click();
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(64, 0);
    await page.reload();
    await expect(page.locator('[data-admin-workspace="library"]')).toBeVisible();
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(64, 0);
    await page.locator("[data-compact-sidebar-expand]").click();
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
      .toBeCloseTo(248, 0);

    const firstPhoto = page
      .locator(".admin-photo-tile [data-library-photo-action]")
      .first();
    await expect(firstPhoto).toBeVisible();
    await firstPhoto.click();
    const inspector = page.locator("[data-library-inspector]");
    const [inspectorBox, scrollBox] = await Promise.all([
      inspector.boundingBox(),
      page.locator("[data-library-scroll]").boundingBox(),
    ]);
    expect(inspectorBox?.width).toBeCloseTo(400, 0);
    expect((scrollBox?.x ?? 0) + (scrollBox?.width ?? 0)).toBeLessThanOrEqual(
      (inspectorBox?.x ?? 0) + 1,
    );

    // PCでも×で閉じられる。閉じた分だけグリッドが広がる（本番で閉じ手段が
    // なかった問題の回帰、オーナー確認 2026-07-30）。
    const closeButton = inspector.locator("[data-library-inspector-close]");
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveAttribute(
      "aria-label",
      /写真の詳細を閉じる|Close photo details/,
    );
    await closeButton.click();
    await expect(inspector).toHaveCount(0);
    const widenedBox = await page
      .locator("[data-library-scroll]")
      .boundingBox();
    expect(widenedBox?.width ?? 0).toBeGreaterThan(
      (scrollBox?.width ?? 0) + 380,
    );

    // Escでも同じ経路で閉じる。入力欄にいる間のEscは編集を捨てない。
    await firstPhoto.click();
    await expect(inspector).toBeVisible();
    const titleInput = inspector
      .locator('input[aria-label="タイトル"], input[aria-label="Title"]')
      .first();
    await titleInput.click();
    await titleInput.fill("Esc guard fixture");
    await titleInput.press("Escape");
    await expect(inspector, "入力中のEscでは詳細を閉じない").toBeVisible();
    await expect(titleInput, "入力中のEscで編集内容を捨てない").toHaveValue(
      "Esc guard fixture",
    );
    // 未保存のまま閉じる時は確認を出す（無言破棄をしない）。
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await page.keyboard.press("Escape");
    const confirm = page.locator("dialog[open]");
    await expect(confirm).toBeVisible();
    // The same Escape must not open a confirmation and then dismiss it through
    // the browser's native cancel action (the modal exits after 160ms).
    await page.waitForTimeout(250);
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: /キャンセル|Cancel/ }).click();
    await expect(inspector, "キャンセルなら詳細は開いたまま").toBeVisible();
    await expect(titleInput, "キャンセルで編集内容を捨てない").toHaveValue(
      "Esc guard fixture",
    );

    // 明示的に破棄して閉じたら、詳細欄は消えて一覧だけに戻る。
    // 確認ダイアログは閉じるアニメーション(160ms)の後にunmountされる。
    // 消えきる前に次の確認を開くと前の後始末に消されるため、消えるまで待つ。
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await closeButton.click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: /保存せず閉じる|Close without saving/ })
      .click();
    await expect(inspector).toHaveCount(0);
  });

  test("390pxでもモード・検索・絞り込み・表示が横にはみ出さない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "390pxの狭い画面で確認する",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await gotoAdminTab(page, "gallery");

    const workbar = page.locator(".admin-library-workbar");
    const workbarBox = await workbar.boundingBox();
    expect(workbarBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((workbarBox?.x ?? 0) + (workbarBox?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );
    await expect(page.locator("[data-library-mobile-select]")).toBeVisible();
    await expect(page.locator("[data-library-search-input]")).toBeVisible();
    await expect(page.locator("[data-library-filters-toggle]")).toBeVisible();
    const viewMenu = page.locator(".admin-library-view-menu > summary");
    await expect(viewMenu).toBeVisible();
    await viewMenu.click();
    const panelBox = await page
      .locator(".admin-library-view-menu__panel")
      .boundingBox();
    expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
