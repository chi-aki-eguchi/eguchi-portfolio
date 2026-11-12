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

  // スマホ：下の入口は 写真・シリーズ・サイト・言葉・メニュー の5つで、言葉が今の場所。
  // 「保存して次へ」の帯は入口の真上に積み、重ならない（2026-11-12）。
  if (page.viewportSize()!.width < 768) {
    const bar = page.locator(".admin-book__tabs");
    await expect(bar.locator("a, button")).toHaveText(["写真", "シリーズ", "サイト", "言葉", "メニュー"]);
    await expect(bar.locator("[aria-current=page]")).toHaveText("言葉");
    const barBox = (await bar.boundingBox())!;
    expect(Math.abs(barBox.y + barBox.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);
    expect(dock.y + dock.height).toBeLessThanOrEqual(barBox.y + 1);
    // 中身の最後まで送ると、2つの帯の上に出る。
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.locator(".aw-fields").boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(dock.y + 1);
  } else {
    await expect(page.locator(".admin-book__tabs")).toBeHidden();
  }
});

test("admin — 言葉を付ける › 戻る先は ?from= で決まり、外のアドレスは無視する", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/words?from=/admin%23photos", { waitUntil: "networkidle" });
  await expect(page.locator(".aw-back")).toHaveAttribute("href", "/admin#photos");
  await page.goto("/admin/words?from=https://example.com/admin", { waitUntil: "networkidle" });
  await expect(page.locator(".aw-back")).toHaveAttribute("href", "/admin");
  await page.goto("/admin/words?from=//example.com", { waitUntil: "networkidle" });
  await expect(page.locator(".aw-back")).toHaveAttribute("href", "/admin");
});
