import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// 「標準」と「写真から」は値を持たず**スタイルシートの既定**が出るので、
// 既定を変えるとここも一緒に動く。3段階が潰れないよう、ゆっくり/すばやくも
// 引き直してある（`lib/hero-motion.ts`）。
// 8/30「もっと余裕を」で 600→780ms、8/31「全体的にまだ速い」で 780→1100ms。
const SPEEDS = [
  { label: "ゆっくり", duration: "1500ms" },
  { label: "標準", duration: "1100ms" },
  { label: "すばやく", duration: "720ms" },
] as const;

const ORDERS = [
  {
    label: "文字から",
    values: ["0.62s", "0s", "0.25s", "0.5s"],
  },
  {
    label: "写真から",
    values: ["0s", "0.39s", "0.64s", "0.9s"],
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
  // プレビューは既定で開く。閉じている時だけ押す。
  const previewOpenButton = page.getByRole("button", { name: "プレビューを開く" });
  if ((await previewOpenButton.count()) > 0) await previewOpenButton.click();
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

  test("選んだレイアウトで効かない設定を見せない", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopの設定パネルで検証");
    await openMotionSettings(page);
    const hero = page.locator('[data-settings-section="hero"]');
    await hero.getByRole("button", { name: /^カルーセル/ }).click();
    await hero
      .getByRole("button", {
        name: "通常（高さ設定に従う）",
        exact: true,
      })
      .click();

    // 通常カルーセル: 高さと文字寄せは効く。暗幕は写真上に名前を置かない
    // この状態では効かないので出さない。
    await expect(
      hero.getByRole("button", { name: "フルスクリーン", exact: true }),
    ).toBeVisible();
    await expect(hero.getByRole("slider", { name: "高さ" })).toBeVisible();
    await expect(
      hero.getByRole("button", { name: "右上", exact: true }),
    ).toBeVisible();
    await expect(
      hero.getByRole("button", { name: "あり", exact: true }),
    ).toHaveCount(0);

    // フルスクリーンでは高さが無効。以前は説明に「無効」と書きながら
    // スライダーを出し続けていた。
    await hero
      .getByRole("button", { name: "フルスクリーン", exact: true })
      .click();
    await expect(hero.getByRole("slider", { name: "高さ" })).toHaveCount(0);
    await expect(
      hero.getByRole("button", { name: "あり", exact: true }),
    ).toBeVisible();

    // 新レイアウト3種は画面の使い方・名前位置を自身で決める。この2項目を
    // 操作してもプレビューが一切変わらないため、値は保持したまま隠す。
    await hero.getByRole("button", { name: /^静謐グリッド/ }).click();
    await expect(
      hero.getByRole("button", { name: "フルスクリーン", exact: true }),
    ).toHaveCount(0);
    await expect(
      hero.getByRole("button", { name: "右上", exact: true }),
    ).toHaveCount(0);
    await expect(
      hero.getByText(
        "このレイアウトは、画面の使い方と名前の位置が専用の配置に固定されます。高さだけ必要に応じて調整できます。",
        { exact: true },
      ),
    ).toBeVisible();
    const resetHeight = hero.getByRole("button", {
      name: "レイアウト本来の高さに戻す",
      exact: true,
    });
    if ((await resetHeight.count()) > 0) await resetHeight.click();
    await expect(hero.getByRole("slider", { name: "高さ" })).toHaveCount(0);
    await hero
      .getByRole("button", { name: "高さを指定", exact: true })
      .click();
    await expect(hero.getByRole("slider", { name: "高さ" })).toBeVisible();
    await resetHeight.click();
    await expect(hero.getByRole("slider", { name: "高さ" })).toHaveCount(0);
  });

  // **2026-08-31 に方針を変えた（オーナー承認）。**それまでここは「即表示」を
  // 求めていた——動きを減らす設定では duration を 0 にする、という書き方。
  // だがこの設定が避けたいのは**視界の中で物が動くこと**（移動・拡大・傾き・
  // 視差）で、静かな濃淡の変化ではない。全部消すと、この設定を入れている人には
  // 現れ方が一つも届かない（オーナー自身がその状態で、6往復ぶんの直しが
  // 見えていなかった）。**消すのは移動、残すのは濃淡。**
  test("OSの動きを減らす設定では、移動は消えるが濃淡は残る", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktopの設定パネルで検証");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const iframe = await openMotionSettings(page);
    const photo = iframe.contentFrame().locator(".hero-photo-reveal").first();
    const text = iframe.contentFrame().locator(".hero-text-reveal").first();

    // **最後には必ず出ること。**ヒーローは animation で濃くなるので、素朴に
    // 「動きを消す」と opacity:0 のまま固まって写真が出なくなる。
    await expect(photo).toHaveCSS("opacity", "1");
    await expect(text).toHaveCSS("opacity", "1");

    // 濃淡は残す。潰れていたらここで落ちる。
    for (const [label, target] of [
      ["写真", photo],
      ["文字", text],
    ] as const) {
      const seconds = await target.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).animationDuration),
      );
      expect(seconds, `${label}の濃淡が潰れている（${seconds}s）`).toBeGreaterThan(0.3);
    }

    // 移動は消す。寄り引きは中の <img> に掛かっている。
    const moved = await iframe
      .contentFrame()
      .locator(".hero-photo-reveal img")
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(moved, `写真が動いている: ${moved}`).toMatch(
      /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
    );
  });
});
