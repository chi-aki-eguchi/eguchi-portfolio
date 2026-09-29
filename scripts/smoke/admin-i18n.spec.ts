import { expect, test } from "./fixtures.ts";
import { gotoAdminTab, loginAsAdmin, chooseSettingsSection } from "./helpers";

// Language selection is browser-only state. This test changes localStorage and
// signs in, but never clicks Save/Delete/Add or any other data-writing action.
test.describe("admin — JP/EN shared shell", () => {
  test("JPのLibraryと写真編集に英語の操作語を残さない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "日本語の語彙はdesktopで1回確認すれば十分",
    );
    await loginAsAdmin(page);
    await page.evaluate(() => localStorage.setItem("admin:language", "ja"));
    await page.reload();

    const tools = page.locator(".admin-book__tools");
    await expect(tools.getByRole("link", { name: /サイトを見る/ })).toBeVisible();
    await expect(tools.getByRole("button", { name: "ログアウト" })).toBeVisible();
    await gotoAdminTab(page, "gallery");
    await expect(page.getByText(/\d+ \/ \d+ 枚/)).toBeVisible();

    await page.getByRole("button", { name: "絞り込み" }).click();
    await expect(page.getByRole("option", { name: /すべて（/ })).toBeAttached();
    await expect(page.getByRole("option", { name: "すべてのシリーズ" })).toBeAttached();
    await expect(page.getByRole("option", { name: "すべてのサイズ" })).toBeAttached();
    await expect(page.getByRole("option", { name: "すべての向き" })).toBeAttached();
    await expect(page.getByRole("option", { name: "すべての期間" })).toBeAttached();

    await page.getByRole("button", { name: "絞り込みを閉じる" }).click();
    await page.locator(".admin-library-view-menu > summary").click();
    await expect(page.getByRole("button", { name: "表形式" })).toBeVisible();
    await expect(page.getByRole("button", { name: /ゴミ箱/ })).toBeVisible();

    await page.locator("[data-library-photo-action]").first().dblclick();
    const inspector = page.locator("[data-library-inspector]");
    await expect(inspector).toHaveAttribute("aria-label", "写真を編集");
    await expect(inspector.locator(".admin-inspector-current-file")).toContainText(/1 \/ \d+/);
    await inspector.getByRole("button", { name: "詳細", exact: true }).click();
    await expect(inspector.getByPlaceholder("タイトル未設定")).toBeVisible();
    await expect(inspector.getByPlaceholder("写真の説明…")).toBeVisible();
    await expect(inspector.getByRole("button", { name: "コピー" })).toBeVisible();
    await expect(inspector.getByRole("button", { name: "貼り付け" })).toBeVisible();
    await expect(inspector.getByLabel("撮影日", { exact: true })).toHaveAttribute(
      "lang",
      "ja-JP",
    );
  });

  test("EN survives reload and is shared by login and the admin shell", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    const loginToggle = page.locator("[data-admin-language-toggle]:visible");
    await expect(loginToggle).toHaveAttribute("data-language", "ja");
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "placeholder",
      "パスワード",
    );

    await loginToggle.getByRole("button", { name: "EN" }).click();
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "placeholder",
      "Password",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("admin:language")),
    ).toBe("en");

    await page.reload();
    await expect(
      page.locator("[data-admin-language-toggle]:visible"),
    ).toHaveAttribute("data-language", "en");
    await loginAsAdmin(page);

    // スマホ幅では、言葉の切り替えは右上の「メニュー」の中にある。
    const menu = page.locator(".admin-book__menu");
    if (await menu.isVisible()) await menu.click();
    const shellToggle = page.locator(
      "[data-admin-language-toggle]:visible",
    );
    await expect(shellToggle).toHaveAttribute("data-language", "en");
    // 入口と目次は日本語のまま（2026-09-29 の器）。編集画面の中身が英語になる。
    await gotoAdminTab(page, "profile");
    await expect(
      page.getByText("Your biography and profile photo shown on the About page."),
    ).toBeVisible();

    if (await menu.isVisible()) await menu.click();
    await shellToggle.getByRole("button", { name: "JP" }).click();
    await page.reload();
    await expect(page.locator(".admin-book__tab").first()).toBeVisible();
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.locator("[data-admin-language-toggle]:visible"),
    ).toHaveAttribute("data-language", "ja");
  });

  test("Phase 2b translates Library, Categories, and Series without writes", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.evaluate(() => localStorage.setItem("admin:language", "en"));

    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") {
        writes.push(`${request.method()} ${request.url()}`);
      }
    });

    await gotoAdminTab(page, "gallery");
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
    await page.locator(".admin-library-view-menu > summary").click();
    await expect(page.getByLabel("Order of this list (does not change the site)")).toBeVisible();
    await page.getByLabel("Choose image files").setInputFiles({ name: "preflight.jpg", mimeType: "image/jpeg", buffer: Buffer.from("preflight") });
    const importDialog = page.getByRole("dialog");
    await expect(importDialog.getByRole("radio", { name: "Digital photographs" })).toBeVisible();
    await expect(importDialog.getByRole("radio", { name: "Film scans" })).toBeVisible();
    await importDialog.getByRole("button", { name: "Close", exact: true }).click();

    await gotoAdminTab(page, "categories");
    await expect(
      page.getByText("Used as Gallery filters", { exact: false }),
    ).toBeVisible();
    // 2026-08-27: 追加フォームは既定で畳まれている。見出しは常に見えるが、
    // 中の入力欄は開かないと見えない。利用者と同じ順に開いてから見る。
    await page.getByText("New Category", { exact: true }).click();
    await expect(page.getByLabel("Category name")).toBeVisible();

    await gotoAdminTab(page, "series");
    await expect(
      page.getByText("Arrange photographs under", { exact: false }),
    ).toBeVisible();
    await page.getByText("New Series", { exact: true }).click();
    await expect(page.getByLabel("New series title")).toBeVisible();

    await gotoAdminTab(page, "settings");
    await chooseSettingsSection(page, "site-basics");
    // 2c-3で設定タブ「基本・見た目」もEN化されたため、境界マーカーをEN表記に更新。
    await expect(
      page.locator(
        '[data-settings-section="site-basics"] [data-settings-section-heading]',
      ),
    ).toContainText("Identity, contact & SEO");
    expect(writes).toEqual([]);
  });
});
