import { test, expect, type Page, type Route } from "@playwright/test";

// 共通ページ枠の見出しが、狭い画面で1文字ずつ縦に積まれないことを幾何で固定する。
// 実測で 390px のとき見出しが 幅43px × 高さ383px になっていた（font-size 34px）。
//
// ログインせず `/api/**` を人工データで塞ぐため、本番DBへは触らない。
// タブ移動はしない：`/admin` を開いた直後の既定タブ（はじめに）が、見出しの右に
// 操作を3つ持つ最も厳しい条件で、実際に壊れていた画面でもある。
// 9タブの左端が揃うことは admin-page-frame.spec.ts が別途見ている。

// **設定はわざと最小にする。** プロフィールや連絡先まで埋めると「はじめに」の
// 手順が進み、見出しの右の操作（「次へ: …」）が消えて、壊れ方を再現できない。
// 実測でもこの最小設定のときだけ 390px で見出しが縦積みになっていた。
const SETTINGS = {
  siteName: "検査用サイト",
  servicePageMode: "off",
};

async function installAdminApiMocks(page: Page) {
  const nonGet: string[] = [];
  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      nonGet.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "write blocked in geometry smoke" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("**/api/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([]) }),
  );
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/settings**", json(SETTINGS));
  await page.route("**/api/photos**", json({ photos: [] }));
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/note-posts**", json({ posts: [] }));

  return { nonGet };
}

test.describe("admin — 共通ページ枠の見出しの形", () => {
  for (const width of [320, 390, 768, 1440] as const) {
    test(`${width}px: 見出しが縦積みにならず、操作も画面内に収まる`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "画面幅はこのスペックの中で明示指定する",
      );

      const mocks = await installAdminApiMocks(page);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        // 「はじめに」を明示して開く。既定タブは前回の状態に左右されるため。
        localStorage.setItem("admin:tab", JSON.stringify("setup"));
        sessionStorage.clear();
      });
      await page.goto("/admin");
      await page.waitForSelector(".admin-atelier", { timeout: 15_000 });

      const title = page.locator("h1.admin-page-header__title").first();
      await title.waitFor({ timeout: 15_000 });

      const box = await title.boundingBox();
      expect(box, "見出しの大きさを測れる").not.toBeNull();
      const fontSize = Number(
        await title.evaluate((el) =>
          getComputedStyle(el).fontSize.replace("px", ""),
        ),
      );

      expect(
        box!.height,
        `${width}px で見出しが縦に積まれている（高さ ${Math.round(box!.height)}px / 文字 ${fontSize}px、幅 ${Math.round(box!.width)}px）`,
      ).toBeLessThanOrEqual(fontSize * 3);

      // 見出しの隣の操作が画面外へ出ていないこと
      const header = title.locator("xpath=ancestor::div[2]");
      const actions = header.locator("button");
      const actionCount = await actions.count();
      for (let i = 0; i < actionCount; i += 1) {
        const actionBox = await actions.nth(i).boundingBox();
        if (!actionBox) continue;
        expect(
          actionBox.x,
          `${width}px: 操作${i} の左端が画面外`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          actionBox.x + actionBox.width,
          `${width}px: 操作${i} の右端が画面外`,
        ).toBeLessThanOrEqual(width + 1);
      }

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(
        scrollWidth,
        `${width}px で横スクロールが出ている`,
      ).toBeLessThanOrEqual(width);

      expect(mocks.nonGet, "本番へ書き込む要求が出ていない").toEqual([]);
    });
  }
});
