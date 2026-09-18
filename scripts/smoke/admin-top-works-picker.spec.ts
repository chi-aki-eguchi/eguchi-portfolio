import { chooseSettingsSection } from "./helpers";
import { expect, test, type Page, type Route } from "./fixtures.ts";

// トップ（Works）に手動で出す写真の選択欄。
//
// 2026-09-19 まで、この欄は候補の格子が1つあるだけで、選んだ写真の並びを
// 「順に読む」場所も、並べ替える手段も無かった。ここで確かめるのは
// 受け入れ条件の一続き —— 12枚を選ぶ → 8枚目を2番目へ → 1枚を外す →
// 取り消す → PC/スマホのプレビュー → 保存。
//
// 人工データだけで動かし、写真一覧の並び順や写真そのものへの書き込みが
// 1件も出ないことを併せて確かめる。

const PHOTO_COUNT = 20;

const PHOTOS = Array.from({ length: PHOTO_COUNT }, (_, index) => {
  const id = 8_100_001 + index;
  return {
    id,
    filename: `top-works-${String(index + 1).padStart(2, "0")}.png`,
    url: `/api/images/top-works/${id}.png`,
    thumbUrl: `/api/images/top-works/thumb-${id}.png`,
    mediumUrl: `/api/images/top-works/medium-${id}.png`,
    title: `Fixture photo ${index + 1}`,
    meta: "",
    description: "",
    category: "",
    camera: null,
    lens: null,
    focalLength: null,
    fNumber: null,
    exposureTime: null,
    iso: null,
    filmType: null,
    shotAt: null,
    displaySize: "M",
    width: 1200,
    height: 800,
    rotationDeg: 0,
    focalX: 50,
    focalY: 50,
    sortOrder: index,
    seriesId: null,
    isPublished: true,
    fileHash: null,
    deletedAt: null,
    createdAt: null,
  };
});

const SETTINGS = {
  publicExperience: "photo-app",
  setupCompleted: "true",
  siteName: "Top works picker fixture",
  siteNameEn: "Top works picker fixture",
  gallerySortOrder: "manual",
  topWorksMode: "manual",
  topWorksIds: "",
  homeGalleryCount: "12",
  servicePageMode: "off",
};

// 1x1 の透明PNG。写真の中身はこの検査の対象ではない。
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function installMocks(page: Page) {
  const saved: Record<string, string>[] = [];
  const nonGet: string[] = [];

  const json = (value: unknown) => (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET")
      nonGet.push(`${request.method()} ${request.url()}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/api/images/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );
  await page.route("**/api/admin/me**", json({ authenticated: true }));
  await page.route("**/api/admin/photos/trash**", json({ photos: [] }));
  await page.route("**/api/photos**", (route) =>
    new URL(route.request().url()).pathname.endsWith("/availability")
      ? json({ total: PHOTOS.length, standalone: PHOTOS.length })(route)
      : json({ photos: PHOTOS })(route),
  );
  await page.route("**/api/categories**", json({ categories: [] }));
  await page.route("**/api/series**", json({ series: [] }));
  await page.route("**/api/admin/series**", json({ series: [] }));
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/pricing**", json({ plans: [] }));
  await page.route("**/api/admin/pricing**", json({ plans: [] }));
  await page.route("**/api/settings**", json(SETTINGS));
  await page.route("**/api/admin/settings**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await json(SETTINGS)(route);
      return;
    }
    nonGet.push(`${request.method()} ${request.url()}`);
    saved.push(request.postDataJSON() as Record<string, string>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ignoredKeys: [] }),
    });
  });

  return { saved, nonGet };
}

async function openPicker(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("admin:settingsDraft");
    localStorage.setItem("admin:tab", JSON.stringify("settings"));
    localStorage.setItem("admin:previewDevice", JSON.stringify("desktop"));
  });
  await page.goto("/admin");
  await page.waitForSelector(".admin-atelier", { timeout: 20_000 });
  await chooseSettingsSection(page, "gallery-layout");
}

/** 「選んだ順」の一覧に並んでいる名前。 */
const chosenNames = (page: Page) =>
  page.locator("[data-top-works-row] [data-top-works-name]").allTextContents();

test.describe("admin — トップに出す写真の選択と並び", () => {
  test("12枚選び、8枚目を2番目へ動かし、外して取り消し、確認して保存できる", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "PCの編集画面で通しで確かめる");
    const mocks = await installMocks(page);
    await openPicker(page);

    const candidates = page.locator("[data-top-works-candidate]");
    await expect(candidates.first()).toBeVisible();

    // 1) 12枚を選ぶ。押した順がそのまま並びになる。
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      await candidates.nth(i).click();
      order.push(`Fixture photo ${i + 1}`);
    }
    await expect(page.locator("[data-top-works-row]")).toHaveCount(12);
    expect(await chosenNames(page)).toEqual(order);
    await expect(page.getByText("選んだ順（12枚）")).toBeVisible();

    // 2) 8枚目を2番目へ。ドラッグに頼らず、押し続けられること自体も確かめる
    //    （動かしたあともフォーカスが同じ操作の上に残る）。
    const eighth = order[7];
    for (let i = 0; i < 6; i++) {
      await page
        .locator("[data-top-works-row]")
        .filter({ hasText: eighth })
        .locator('[data-top-works-control^="up-"]')
        .click();
    }
    const moved = await chosenNames(page);
    expect(moved.indexOf(eighth)).toBe(1);
    expect(moved).toEqual([
      order[0],
      order[7],
      ...order.slice(1, 7),
      ...order.slice(8),
    ]);
    // 動かしたあとも「前へ」の上にフォーカスが残る（連打で並べ替えられる）。
    expect(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("data-top-works-control"),
      ),
    ).toBe("up-1");

    // 3) 1枚を外す。
    await page
      .locator("[data-top-works-row]")
      .filter({ hasText: order[3] })
      .getByRole("button", { name: `${order[3]}をトップから外す` })
      .click();
    await expect(page.locator("[data-top-works-row]")).toHaveCount(11);
    expect(await chosenNames(page)).not.toContain(order[3]);

    // 4) 取り消す（既存の設定Undo。新しい取り消しの仕組みは足していない）。
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator("[data-top-works-row]")).toHaveCount(12);
    expect(await chosenNames(page)).toEqual(moved);

    // 5) PC・スマホのプレビューで、選んだ順のまま見えることを確かめる。
    //    この節を開いた直後のプレビューは Gallery を映すが、トップにしか
    //    出ない設定を触ったらトップへ向き直る（選んでも何も変わらない画面を
    //    見せない）。
    const iframe = page.locator('iframe[title="Site Preview"]');
    await expect(iframe).toBeVisible();
    await expect
      .poll(() => iframe.evaluate((el: HTMLIFrameElement) => new URL(el.src).pathname))
      .toBe("/");
    const previewAlts = async () =>
      page
        .frameLocator('iframe[title="Site Preview"]')
        .locator(".photo-card img")
        .evaluateAll((els) =>
          els.map((el) => (el as HTMLImageElement).alt).filter(Boolean),
        );
    await expect.poll(async () => (await previewAlts()).slice(0, 2)).toEqual([
      moved[0],
      moved[1],
    ]);
    await page.getByRole("button", { name: "スマホ幅", exact: true }).click();
    await expect.poll(async () => (await previewAlts()).slice(0, 2)).toEqual([
      moved[0],
      moved[1],
    ]);
    await page.getByRole("button", { name: "PC幅", exact: true }).click();

    // 6) 保存。送るのは topWorksIds だけで、写真一覧の並び順も写真そのものも
    //    書き換えない。
    await page
      .locator("[data-settings-save-panel]")
      .getByRole("button", { name: "保存", exact: true })
      .click();
    await expect.poll(() => mocks.saved.length).toBe(1);
    const expectedIds = moved.map(
      (name) => PHOTOS.find((photo) => photo.title === name)!.id,
    );
    expect(mocks.saved[0].topWorksIds).toBe(expectedIds.join(","));
    expect(
      mocks.nonGet.filter((entry) => !entry.includes("/api/admin/settings")),
      "設定の保存以外へ書き込んでいない",
    ).toEqual([]);
  });

  test("タッチでも選び、順を入れ替え、外せる（当たり判定40px以上）", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "mobile-touch",
      "指で触る端末の当たり判定と操作を確かめる",
    );
    const mocks = await installMocks(page);
    await openPicker(page);

    const candidates = page.locator("[data-top-works-candidate]");
    await expect(candidates.first()).toBeVisible();
    for (let i = 0; i < 3; i++) await candidates.nth(i).tap();
    await expect(page.locator("[data-top-works-row]")).toHaveCount(3);

    // 並べ替え・外すは指で押せる大きさか（見た目は24pxのまま、当たり判定を広げる）。
    for (const control of await page
      .locator("[data-top-works-row] button")
      .all()) {
      const box = (await control.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
    }

    await page
      .locator("[data-top-works-row]")
      .nth(2)
      .locator('[data-top-works-control^="up-"]')
      .tap();
    expect(await chosenNames(page)).toEqual([
      "Fixture photo 1",
      "Fixture photo 3",
      "Fixture photo 2",
    ]);

    await page
      .locator("[data-top-works-row]")
      .nth(0)
      .getByRole("button", { name: /トップから外す$/ })
      .tap();
    expect(await chosenNames(page)).toEqual([
      "Fixture photo 3",
      "Fixture photo 2",
    ]);
    expect(mocks.nonGet, "触っただけでは何も書き込まない").toEqual([]);
  });

  test("公開されていない写真が選択に残っていても、外せる形で見える", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "PCの編集画面で確かめる");
    await installMocks(page);
    // 候補（公開中の写真）に無い ID を混ぜる。公開側はこの ID を黙って
    // 飛ばすので、管理画面で気づけないと消せないまま残る。
    const orphan = 8_900_001;
    await page.route("**/api/settings**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...SETTINGS,
          topWorksIds: `${PHOTOS[0].id},${orphan},${PHOTOS[1].id}`,
        }),
      }),
    );
    await openPicker(page);

    const rows = page.locator("[data-top-works-row]");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText("この写真はいま公開されていません");
    await rows
      .nth(1)
      .getByRole("button", { name: /トップから外す$/ })
      .click();
    await expect(rows).toHaveCount(2);
  });
});
