import { expect, test, type Page, type Route } from "./fixtures.ts";

// ページの写真（/admin/pages）。新しい構成の Portrait／Life に出す写真を選んで並べる画面。
//
// 確かめること（人工データだけ。保存は全部ここで受け止め、本物へは1件も出さない）:
//   1. まだ選んでいないページは、いま出ている写真（分類から）を見せる。番号は出さない
//   2. 押して選ぶ → 下の帯でまとめて動かす → その並びが保存される。写真は作り直されない。元に戻せる
//   3. つかんで動かす（PC）
//   4. つまみで写真を小さくすると、1段に入る枚数が増える
//   5. 写真を足す：月ごとの区切り（新しい月が上）・絞り込み・選んだ写真が最後に入る
//   6. 保存に失敗したら、並びを元へ戻して、画面で知らせる
//   7. サイトの構成の切り替えは、一度確かめてから保存する
//   8. ログインしていなければ、ログインを案内する

const MONTHS = ["2026-08", "2026-03", "2025-10", "2025-08", "2025-02", "2024-12", "2024-08", "2024-01", "2023-11", "2023-03"];
const PHOTOS = Array.from({ length: 30 }, (_, index) => {
  const id = 9_200_001 + index;
  return {
    id,
    filename: `page-photo-${index + 1}.png`,
    url: `/api/images/page-photos/${id}.png`,
    thumbUrl: `/api/images/page-photos/thumb-${id}.png`,
    mediumUrl: `/api/images/page-photos/medium-${id}.png`,
    title: "",
    meta: "",
    description: "",
    category: index < 6 ? "portrait" : index < 11 ? "life" : index < 13 ? "nature" : "",
    camera: null,
    lens: null,
    filmType: index % 5 === 0 ? "フィルム" : "デジタル",
    shotAt: `${MONTHS[index % MONTHS.length]}-1${index % 9}T10:00:00`,
    displaySize: "M",
    width: 1200,
    height: 800,
    rotationDeg: 0,
    focalX: 50,
    focalY: 50,
    sortOrder: index,
    seriesId: index % 7 === 0 ? 1 : null,
    seriesIds: index % 7 === 0 ? [1] : [],
    createdAt: "2026-09-01T00:00:00.000Z",
  };
});
const PORTRAIT = PHOTOS.filter((p) => p.category === "portrait").map((p) => p.id);
const LIFE = PHOTOS.filter((p) => p.category === "life" || p.category === "nature").map((p) => p.id);

// 1x1 の透明PNG。写真の中身はこの検査の対象ではない。
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function installMocks(page: Page, options: { authenticated?: boolean; failSave?: boolean } = {}) {
  const settings: Record<string, string> = {
    setupCompleted: "true",
    siteName: "Page photos fixture",
    siteDesign: "classic",
    gallerySortOrder: "manual",
    developPortraitIds: "",
    developLifeIds: "",
    servicePageMode: "off",
  };
  const saved: Record<string, string>[] = [];
  const state = { failSave: options.failSave ?? false };
  const json = (value: unknown) => (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });

  await page.route("**/api/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/images/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await page.route("**/api/admin/me**", json({ authenticated: options.authenticated ?? true }));
  await page.route("**/api/photos**", (route) =>
    new URL(route.request().url()).pathname.endsWith("/availability")
      ? json({ total: PHOTOS.length, standalone: PHOTOS.length })(route)
      : json({ photos: PHOTOS })(route),
  );
  await page.route("**/api/series**", (route) =>
    json({ series: new URL(route.request().url()).searchParams.get("kind") === "work" ? [] : [{ id: 1, title: "港の記録", slug: "harbor" }] })(route),
  );
  await page.route("**/api/hero-photos**", json({ heroPhotos: [] }));
  await page.route("**/api/settings**", (route) => json(settings)(route));
  await page.route("**/api/admin/settings**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return json(settings)(route);
    if (state.failSave) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    const body = request.postDataJSON() as Record<string, string>;
    saved.push(body);
    Object.assign(settings, body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ignoredKeys: [] }) });
  });
  return { saved, settings, state };
}

const shownIds = (page: Page) =>
  page.locator(".pp-grid .pp-tile").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo"))));
const columns = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => {
    const top = els[0]?.getBoundingClientRect().top ?? 0;
    return els.filter((e) => Math.abs(e.getBoundingClientRect().top - top) < 2).length;
  });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

async function open(page: Page) {
  await page.goto("/admin/pages", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "ページの写真" })).toBeVisible();
  await expect(page.locator(".pp-grid .pp-tile").first()).toBeVisible();
}

test.describe("admin — ページの写真（選んで並べる）", () => {
  test("選んでいないページは分類の写真を見せ、押して選んでまとめて動かすと保存される", async ({ page }) => {
    const mocks = await installMocks(page);
    await open(page);
    // まだ選んでいない：分類 portrait の6枚が、管理画面の並び順で出ている。番号は出さない。
    expect(await shownIds(page)).toEqual(PORTRAIT);
    await expect(page.locator(".pp-note")).toBeVisible();
    expect(await page.locator(".pp-grid .pp-tile").evaluateAll((els) => els.filter((e) => /\d/.test(e.textContent ?? "")).length)).toBe(0);
    await expect(page.locator(".pp-selbar[data-show]")).toHaveCount(0);
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

    // 写真は作り直されないこと（作り直すと、スマホでは一瞬消えて出直す）。
    await page.locator(".pp-grid .pp-tile img").evaluateAll((imgs) => imgs.forEach((img) => img.setAttribute("data-kept", "")));

    await page.locator(".pp-grid .pp-tile").nth(0).click();
    await page.locator(".pp-grid .pp-tile").nth(3).click();
    await expect(page.locator(".pp-selbar[data-show]")).toContainText("2 枚を選択中");
    await page.getByRole("button", { name: "最後へ" }).click();
    const moved = [PORTRAIT[1], PORTRAIT[2], PORTRAIT[4], PORTRAIT[5], PORTRAIT[0], PORTRAIT[3]];
    await expect.poll(() => shownIds(page)).toEqual(moved);
    await expect.poll(() => mocks.saved.length).toBe(1);
    expect(mocks.saved[0]).toEqual({ developPortraitIds: moved.join(",") });
    await expect(page.locator(".pp-toast[data-show]")).toContainText("並べ替えました");
    await expect(page.locator(".pp-note")).toHaveCount(0);
    expect(await page.locator(".pp-grid .pp-tile img:not([data-kept])").count()).toBe(0);

    // 元に戻す：前の値（何も選んでいない＝分類から）を保存し直す。
    await page.locator(".pp-toast").getByRole("button", { name: "元に戻す" }).click();
    await expect.poll(() => mocks.saved.length).toBe(2);
    expect(mocks.saved[1]).toEqual({ developPortraitIds: "" });
    await expect.poll(() => shownIds(page)).toEqual(PORTRAIT);

    // 選んで外す。
    await page.getByRole("button", { name: "選択をやめる" }).click();
    await page.locator(".pp-grid .pp-tile").nth(2).click();
    await page.getByRole("button", { name: "外す" }).click();
    const removed = PORTRAIT.filter((_, i) => i !== 2);
    await expect.poll(() => shownIds(page)).toEqual(removed);
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developPortraitIds: removed.join(",") });
    await expect(page.locator(".pp-selbar[data-show]")).toHaveCount(0);

    // Life のページは別の並び。
    await page.locator('[data-pp-tab="life"]').click();
    await expect.poll(() => shownIds(page)).toEqual(LIFE);
  });

  test("つかんで動かす・つまみで小さくする", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "マウスでつかむ操作は PC で確かめる");
    const mocks = await installMocks(page);
    await open(page);
    const tiles = page.locator(".pp-grid .pp-tile");
    const from = (await tiles.nth(4).boundingBox())!;
    const to = (await tiles.nth(1).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2 - 10, { steps: 3 });
    await page.mouse.move(to.x + to.width * 0.2, to.y + to.height / 2, { steps: 12 });
    // つかんでいる間：写真が付いてきて、行き先に線が出る。
    await expect(page.locator(".pp-ghost")).toHaveCount(1);
    await expect(page.locator(".pp-dropline")).toHaveCount(1);
    await page.mouse.up();
    const dragged = [PORTRAIT[0], PORTRAIT[4], PORTRAIT[1], PORTRAIT[2], PORTRAIT[3], PORTRAIT[5]];
    await expect.poll(() => shownIds(page)).toEqual(dragged);
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developPortraitIds: dragged.join(",") });
    await expect(page.locator(".pp-ghost")).toHaveCount(0);
    // つかんだ直後の「押した」は、選んだことにしない。
    await expect(page.locator('.pp-grid .pp-tile[aria-pressed="true"]')).toHaveCount(0);

    const before = await columns(page, ".pp-grid .pp-tile");
    await page.locator('.pp-tools input[type="range"]').fill("8");
    await expect.poll(() => columns(page, ".pp-grid .pp-tile")).toBeGreaterThan(before);
    expect(await page.evaluate(() => localStorage.getItem("admin:pagePhotos:zoom:page"))).toBe("8");
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  });

  test("写真を足す：月ごとの区切り・絞り込み・選んだ写真は最後に入る", async ({ page }) => {
    const mocks = await installMocks(page);
    await open(page);
    await page.getByRole("button", { name: "写真を足す" }).click();
    const sheet = page.locator(".pp-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-pp-count]")).toHaveText("6 枚を選択中");
    // 月ごとに区切られ、新しい月が上。全部の写真が出ていて、今の6枚に印。番号は出さない。
    const periods = await sheet.locator(".pp-period").evaluateAll((els) => els.map((e) => e.getAttribute("data-period")));
    expect(periods).toEqual([...MONTHS]);
    await expect(sheet.locator(".pp-pick")).toHaveCount(PHOTOS.length);
    await expect(sheet.locator('.pp-pick[aria-pressed="true"]')).toHaveCount(6);
    expect(await sheet.locator(".pp-pick").evaluateAll((els) => els.filter((e) => /\d/.test(e.textContent ?? "")).length)).toBe(0);
    await expect(sheet.locator(".pp-now b")).toHaveText("2026年 8月");
    // 上の帯の題と「これで決める」が、画面の幅に収まる。
    const done = (await sheet.locator("[data-pp-done]").boundingBox())!;
    expect(done.x + done.width).toBeLessThanOrEqual(page.viewportSize()!.width);

    // シリーズで絞る → 戻す。
    await sheet.locator(".pp-chips select").selectOption("1");
    await expect(sheet.locator(".pp-pick")).toHaveCount(PHOTOS.filter((p) => p.seriesIds.length).length);
    await sheet.locator(".pp-chips select").selectOption("");
    // まだ出していない写真から1枚選ぶ → 決める。
    await sheet.locator('[data-filter="unused"]').click();
    await expect(sheet.locator(".pp-pick")).toHaveCount(PHOTOS.length - PORTRAIT.length - LIFE.length);
    const added = Number(await sheet.locator(".pp-pick").first().getAttribute("data-photo"));
    await sheet.locator(".pp-pick").first().click();
    await expect(sheet.locator("[data-pp-count]")).toHaveText("7 枚を選択中");
    await sheet.locator("[data-pp-done]").click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => shownIds(page)).toEqual([...PORTRAIT, added]);
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developPortraitIds: [...PORTRAIT, added].join(",") });

    // Esc は何も変えずに閉じる。
    await page.getByRole("button", { name: "写真を足す" }).click();
    await page.locator(".pp-sheet .pp-pick").first().click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".pp-sheet")).toHaveCount(0);
    expect(await shownIds(page)).toEqual([...PORTRAIT, added]);
  });

  test("保存に失敗したら、並びを元へ戻して画面で知らせる", async ({ page }) => {
    const mocks = await installMocks(page, { failSave: true });
    await open(page);
    await page.locator(".pp-grid .pp-tile").nth(0).click();
    await page.getByRole("button", { name: "最後へ" }).click();
    await expect(page.getByRole("alert")).toContainText("保存できませんでした");
    await expect.poll(() => shownIds(page)).toEqual(PORTRAIT);
    expect(mocks.saved).toEqual([]);
  });

  test("サイトの構成は、一度確かめてから切り替える", async ({ page }) => {
    const mocks = await installMocks(page);
    await open(page);
    await expect(page.locator('[data-pp-design="classic"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-pp-design="develop"]').click();
    // 押しただけでは保存しない。
    await expect(page.getByRole("alertdialog")).toContainText("公開サイトが「新しい構成」に切り替わります");
    expect(mocks.saved).toEqual([]);
    await page.locator("[data-pp-confirm]").click();
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ siteDesign: "develop" });
    await expect(page.locator('[data-pp-design="develop"]')).toHaveAttribute("aria-pressed", "true");
    // 戻すのも同じ手順。
    await page.locator('[data-pp-design="classic"]').click();
    await page.locator("[data-pp-confirm]").click();
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ siteDesign: "classic" });
  });

  test("ログインしていなければ、ログインを案内する", async ({ page }) => {
    await installMocks(page, { authenticated: false });
    await page.goto("/admin/pages", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "ログインする" })).toBeVisible();
    await expect(page.locator(".pp-grid")).toHaveCount(0);
  });
});
