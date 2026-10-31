import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";

/**
 * トップの展示（shared/exhibition.ts）。人工データの上で、設定だけこの spec の中で差し替えて見る（保存はしない）。
 *
 * 1. 写真を切り抜かず、札・続く写真・言葉の目次・Instagram が出る
 * 2. 同梱の写真が、いつもの画像の経路（/api/images/…）で配信される
 * 3. 押すといつものビューアが、表紙から順に開く
 * 4. 写真・文を足すと出る。書いていない文の場所は取らない
 * 5. 止めると、いつものトップに戻る
 */
async function withSettings(page: Page, api: SmokeApi, patch: Record<string, string>) {
  const base = (await (await api.get("/api/settings")).json()) as Record<string, string>;
  await page.route(
    (url) => url.pathname === "/api/settings",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...base,
          siteDesign: "develop",
          homeExhibition: "on",
          profileInstagram: "https://www.instagram.com/example_user/",
          ...patch,
        }),
      }),
  );
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("dv-intro-seen", "1");
    } catch {
      // 覚えを書けない環境は対象外
    }
  });
});

test("展示のトップ › 写真を切り抜かず、札と続きの入口を出す", async ({ page, api }) => {
  await withSettings(page, api, {});
  await page.goto("/", { waitUntil: "networkidle" });

  const cover = page.locator("img.hero-single-img");
  await expect(cover).toHaveJSProperty("complete", true);
  expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await cover.evaluate((img) => getComputedStyle(img).objectFit)).toBe("contain");
  // 写真の上に文字も陰も重ねない。名前と展示の名前は札にある。
  await expect(page.locator(".hero-single-caption")).toBeHidden();
  await expect(page.locator(".ex-label h1")).toBeVisible();
  await expect(page.locator(".ex-label__show")).toContainText("日藝祭 2026 展示作品");
  await expect(page.locator(".ex-label__show")).toContainText("2026年11月1日〜3日");

  // 続く写真は枠の比が写真の比と同じ（切り抜かれていない）。
  const works = page.locator(".ex-work__open");
  await expect(works).toHaveCount(4);
  const off = await works.evaluateAll((els) =>
    els.filter((el) => {
      const box = el.getBoundingClientRect();
      return Math.abs(box.width / box.height - Number(getComputedStyle(el).getPropertyValue("--ex-ar"))) > 0.02;
    }).length,
  );
  expect(off).toBe(0);

  // 続きは言葉の目次。写真を挟まず、最後に Instagram。
  await expect(page.locator(".dv-doors[data-plain]")).toBeVisible();
  await expect(page.locator(".dv-door__photo")).toHaveCount(0);
  const instagram = page.locator('.dv-door[href="https://www.instagram.com/example_user/"]');
  await expect(instagram).toContainText("Instagram");
  await expect(instagram).toContainText("@example_user");
  await expect(instagram).toHaveAttribute("target", "_blank");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});

test("展示のトップ › 同梱の写真は、いつもの画像の経路で配信される", async ({ api }) => {
  const small = await api.get("/api/images/exhibition/2026-nichigei/back.jpg?w=400&q=80&fmt=jpeg");
  expect(small.status()).toBe(200);
  expect(small.headers()["content-type"]).toBe("image/jpeg");
  expect((await api.get("/api/images/exhibition/2026-nichigei/none.jpg")).status()).toBe(404);
});

test("展示のトップ › 押すとビューアが表紙から順に開く", async ({ page, api }) => {
  await withSettings(page, api, {});
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator(".ex-cover__open").click();
  // ビューアは前後の写真も先読みするので、画面の真ん中に見えている1枚を読む。
  const shown = () =>
    page.evaluate(() => {
      const [cx, cy] = [innerWidth / 2, innerHeight / 2];
      const img = [...document.querySelectorAll<HTMLImageElement>("body img")].find((el) => {
        const box = el.getBoundingClientRect();
        return (
          !el.closest(".top-page") &&
          Number(getComputedStyle(el).opacity) > 0.5 &&
          box.left <= cx && box.right >= cx && box.top <= cy && box.bottom >= cy
        );
      });
      return img?.currentSrc.match(/2026-nichigei\/(\w+)\.jpg/)?.[1];
    });
  await expect.poll(shown).toBe("back");
  await page.keyboard.press("ArrowRight");
  await expect.poll(shown).toBe("room");
});

test("展示のトップ › 足した写真と文が出て、書いていない文は場所を取らない", async ({ page, api }) => {
  const photos = ((await (await api.get("/api/photos")).json()) as { photos: { id: number; title: string }[] }).photos;
  const added = photos[0]!;
  await withSettings(page, api, {
    exhibitionPhotoIds: `-2,-1,${added.id}`,
    exhibitionCaptions: JSON.stringify({ [-1]: "背中" }),
    exhibitionText: "展示に添える文。",
  });
  await page.goto("/", { waitUntil: "networkidle" });
  // 先頭が表紙になり、残りが続く。
  await expect(page.locator("img.hero-single-img")).toHaveAttribute("src", /room\.jpg/);
  await expect(page.locator(".ex-work__open")).toHaveCount(2);
  // 足したライブラリの写真は、その写真の題がそのまま出る。
  await expect(page.locator(".ex-work__title")).toHaveText(["背中", added.title]);
  await expect(page.locator(".ex-works__text")).toHaveText("展示に添える文。");
});

test("展示のトップ › 題と会期を空にすると、その札を出さない", async ({ page, api }) => {
  await withSettings(page, api, { exhibitionTitle: "", exhibitionDates: "" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".ex-label h1")).toBeVisible();
  await expect(page.locator(".ex-label__show")).toHaveCount(0);
  await expect(page.locator(".ex-works__text")).toHaveCount(0);
});

test("展示のトップ › 止めると、いつものトップに戻る", async ({ page, api }) => {
  await withSettings(page, api, { homeExhibition: "off" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".ex-cover")).toHaveCount(0);
  await expect(page.locator(".ex-works")).toHaveCount(0);
  await expect(page.locator(".dv-doors")).toBeVisible();
  await expect(page.locator(".dv-doors[data-plain]")).toHaveCount(0);
});
