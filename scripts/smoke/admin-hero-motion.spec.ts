import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SPEEDS = [
  { label: "ゆっくり", duration: "850ms" },
  { label: "標準", duration: "600ms" },
  { label: "すばやく", duration: "400ms" },
] as const;

const ORDERS = [
  {
    label: "文字から",
    values: ["0.3s", "0s", "0.1s", "0.2s"],
  },
  {
    label: "写真から",
    values: ["0s", "0.2s", "0.3s", "0.4s"],
  },
  {
    label: "同時に",
    values: ["0s", "0s", "0s", "0s"],
  },
] as const;

const HERO_MODES = [
  { label: /^カルーセル/, value: "carousel" },
  { label: /^1枚絵/, value: "single" },
  { label: /^静謐グリッド/, value: "quiet-grid" },
  { label: /^エディトリアル/, value: "editorial" },
  { label: /^没入型/, value: "immersive" },
] as const;

async function openMotionSettings(page: Parameters<typeof loginAsAdmin>[0]) {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Settings" }).click();
  // 設定の本文は目次で選んだ1節だけを出す。折りたたみ行は廃止した。
  await page.locator('[data-settings-section-link="hero"]').click();
  await expect(page.locator('[data-settings-section="hero"]')).toBeVisible();
  await page.getByRole("button", { name: "Live Preview" }).click();
  const iframe = page.locator('iframe[title="Site Preview"]');
  await expect(iframe).toBeVisible();
  await expect(iframe.contentFrame().locator(".top-page")).toHaveCount(1);
  return iframe;
}

test.describe("admin — TOPの動き設定", () => {
  test("3段階×3順番と全Heroモードを保存せずプレビューできる", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopの設定パネルで検証");
    const iframe = await openMotionSettings(page);

    for (const speed of SPEEDS) {
      await page
        .getByRole("button", { name: `登場する速さ: ${speed.label}` })
        .click();
      for (const order of ORDERS) {
        await page
          .getByRole("button", { name: `出てくる順番: ${order.label}` })
          .click();
        await expect
          .poll(() =>
            iframe.evaluate((el: HTMLIFrameElement) => {
              const root = el.contentDocument?.documentElement;
              if (!root) return [];
              const style = getComputedStyle(root);
              return [
                style.getPropertyValue("--top-motion-duration").trim(),
                style.getPropertyValue("--hero-photo-delay").trim(),
                style.getPropertyValue("--hero-text-delay-1").trim(),
                style.getPropertyValue("--hero-text-delay-2").trim(),
                style.getPropertyValue("--hero-text-delay-3").trim(),
              ];
            }),
          )
          .toEqual([speed.duration, ...order.values]);
      }
    }

    for (const mode of HERO_MODES) {
      await page.getByRole("button", { name: mode.label }).click();
      const top = iframe
        .contentFrame()
        .locator(`.top-page[data-hero-mode="${mode.value}"]`);
      await expect(top).toHaveCount(1);
      expect(await top.locator(".hero-photo-reveal").count()).toBeGreaterThan(0);
      expect(await top.locator(".hero-text-reveal").count()).toBeGreaterThan(0);

      const stage = top.locator(".hero-motion-stage");
      const stageCount = await stage.count();
      expect(stageCount).toBe(1);
      const before = await stage.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height };
      });
      const photo = top.locator(".hero-photo-reveal").first();
      await expect
        .poll(() =>
          photo.evaluate((el) => el.getAnimations()[0]?.startTime ?? null),
        )
        .not.toBeNull();
      await expect
        .poll(() =>
          photo.evaluate((el) =>
            el.getAnimations().every((animation) => animation.playState === "finished"),
          ),
        )
        .toBe(true);
      const after = await stage.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height };
      });
      expect(Math.abs(after.top - before.top)).toBeLessThan(1);
      expect(Math.abs(after.width - before.width)).toBeLessThan(1);
      expect(Math.abs(after.height - before.height)).toBeLessThan(1);
      const animationStart = await photo.evaluate(
        (el) => el.getAnimations()[0]?.startTime ?? null,
      );
      await iframe.evaluate((el: HTMLIFrameElement) => {
        el.contentWindow?.scrollTo(0, el.contentDocument?.body.scrollHeight ?? 0);
        el.contentWindow?.scrollTo(0, 0);
      });
      await page.waitForTimeout(50);
      expect(
        await photo.evaluate(
          (el) => el.getAnimations()[0]?.startTime ?? null,
        ),
      ).toBe(animationStart);
    }
  });

  test("OSの動きを減らす設定では写真も文字も即表示する", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopの設定パネルで検証");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const iframe = await openMotionSettings(page);
    const photo = iframe.contentFrame().locator(".hero-photo-reveal").first();
    const text = iframe.contentFrame().locator(".hero-text-reveal").first();

    await expect(photo).toHaveCSS("opacity", "1");
    await expect(text).toHaveCSS("opacity", "1");
    const durationSeconds = await photo.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).animationDuration),
    );
    expect(durationSeconds).toBeLessThanOrEqual(0.001);
  });
});
