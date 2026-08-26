import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 回帰テスト(工程2 fix #3): Settingsのライブプレビューiframeが、タブ移動→復帰で
// 初回 /api/settings フェッチとpostMessageハンドシェイクが競合し、未保存の
// プレビュー値がDB保存値に巻き戻ってしまうバグ。desktopのみ(サイドバー操作)。
test.describe("admin — ライブプレビューがタブ復帰後も編集内容を保持する", () => {
  test("背景色プレビューがタブ切替→復帰後も保持される", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "サイドバー操作のため desktop のみで検証",
    );
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(400);
    // プレビューは既定で開く。閉じている時だけ押す。
  const previewOpenButton = page.getByRole("button", { name: "プレビューを開く" });
  if ((await previewOpenButton.count()) > 0) await previewOpenButton.click();
    await page.waitForTimeout(300);
    await page.locator('[data-settings-section-link="theme"]').click();
    await page.waitForTimeout(200);

    // exact: 「暗い表示のときの背景色（HEX）」など、この名前を含む別の入力が
    // 増えても、明るい表示用の入力だけを掴み続けるため。
    await page.getByLabel("背景色（HEX）", { exact: true }).fill("#000005");
    await page.waitForTimeout(600);

    const iframe = page.locator('iframe[title="Site Preview"]');
    const readBg = () =>
      iframe.evaluate(
        (el: HTMLIFrameElement) =>
          el.contentDocument?.documentElement.style.getPropertyValue(
            "--background",
          ) ?? "",
      );

    expect((await readBg()).trim()).toBe("#000005");

    await page.getByRole("button", { name: "Library" }).click();
    await page
      .getByRole("button", { name: "保存せず移動" })
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForSelector('iframe[title="Site Preview"]', {
      timeout: 10_000,
    });
    // 修正前はここで初回フェッチがプレビュー値を巻き戻すレースが起きた。
    await page.waitForTimeout(2500);

    expect((await readBg()).trim()).toBe("#000005");
  });
});
