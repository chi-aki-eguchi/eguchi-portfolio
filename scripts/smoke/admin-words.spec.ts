import { test, expect } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

// 言葉を付ける（/admin/words）。写真1枚ずつに題・説明・分類を付けていく画面。
// 保存は spec の中で受け止めて、送られた中身だけを確かめる（人工データも書き換えない）。
test("admin — 言葉を付ける › 題を書いて「保存して次へ」で次の写真へ進み、押す物は 44px 以上", async ({ page }) => {
  await loginAsAdmin(page);
  const sent: { id: string; body: Record<string, unknown> }[] = [];
  await page.route(
    (url) => /^\/api\/admin\/photos\/\d+$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      sent.push({ id: new URL(route.request().url()).pathname.split("/").pop()!, body: route.request().postDataJSON() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    },
  );
  await page.goto("/admin/words", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "言葉を付ける" })).toBeVisible();
  const caption = page.locator(".aw-photo figcaption");
  await expect(caption).toContainText("1 /");
  const primary = page.locator(".aw-dock .aw-primary");
  // 何も変えていなければ、送らずに進む。
  await expect(primary).toHaveText("次へ");
  await primary.click();
  await expect(caption).toContainText("2 /");
  expect(sent).toHaveLength(0);
  // 書いたら「保存して次へ」。送る中身は、題・説明・分類。
  await page.locator(".aw-field input").fill("  朝の港  ");
  await page.locator(".aw-field textarea").fill("説明の文。");
  await expect(primary).toHaveText("保存して次へ");
  await primary.click();
  await expect(caption).toContainText("3 /");
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body).toMatchObject({ title: "朝の港", description: "説明の文。" });
  // 戻ると、書いた言葉が入っている。
  await page.locator(".aw-step").click();
  await expect(page.locator(".aw-field input")).toHaveValue("朝の港");
  // 押す物は 44px 以上、横にはみ出さない、下の帯は画面の中。
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".aw-root button, .aw-root a, .aw-root input, .aw-root textarea")]
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height < 44)
      .map((el) => el.textContent?.trim() || el.tagName),
  );
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const dock = (await page.locator(".aw-dock").boundingBox())!;
  expect(dock.y + dock.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
});
