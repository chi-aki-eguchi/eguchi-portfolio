import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin — accentと意味色を混同しない", () => {
  test("Serviceの削除は通常時ニュートラル、hover時だけdangerになる", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    const serviceTab = page.getByRole("button", { name: "Portfolio Kit" });
    test.skip(
      (await serviceTab.count()) === 0,
      "Serviceページが設定で非表示のため、この見た目検査は対象外",
    );
    await serviceTab.click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "実例セクション" }).click();
    await page.waitForTimeout(400);

    const del = page.locator('button[title="削除"]').first();
    await expect(del).toBeVisible();

    const restColor = await del.evaluate((el) => getComputedStyle(el).color);
    const danger = await del.evaluate((el) =>
      getComputedStyle(el.closest(".admin-atelier")!).getPropertyValue(
        "--admin-danger",
      ),
    );
    expect(restColor).not.toBe("rgb(163, 59, 46)");
    await del.hover();
    await expect(del).toHaveCSS("color", "rgb(163, 59, 46)");
    expect(danger.trim()).toBe("#a33b2e");
  });

  test("Library写真選択は淡い青accentを使い、4つの意味色とは独立する", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Library" }).click();
    await page.waitForTimeout(1500);

    await page.locator('[data-library-mode-action="select"]').click();
    const tile = page.locator(".admin-photo-tile").first();
    await tile.click();
    await page.waitForTimeout(300);

    const boxShadow = await tile.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(boxShadow).toContain("rgb(91, 127, 160)");
    expect(boxShadow).not.toContain("rgb(163, 59, 46)");

    const tokens = await page.locator(".admin-atelier").evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        "--admin-accent",
        "--admin-danger",
        "--admin-warning",
        "--admin-success",
        "--admin-info",
      ].map((name) => style.getPropertyValue(name).trim());
    });
    expect(tokens[0]).toBe("#5b7fa0");
    expect(new Set(tokens).size).toBe(5);
  });

  test("1440px・1024px・390pxで意味色整理後も横にはみ出さない", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "1つのdesktopセッションで3幅を連続検証",
    );
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.locator('[data-admin-form-layout="settings"]')).toBeVisible();

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(() => ({
            body: document.body.scrollWidth - document.body.clientWidth,
            form:
              document.querySelector<HTMLElement>(
                '[data-admin-form-layout="settings"]',
              )!.scrollWidth -
              document.querySelector<HTMLElement>(
                '[data-admin-form-layout="settings"]',
              )!.clientWidth,
          })),
        )
        .toEqual({ body: 0, form: 0 });
    }
  });
});
