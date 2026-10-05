import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { BOOK_DESIGN_ENABLED } from "./site-design.ts";
import { loginAsAdmin, openSitePart } from "./helpers";

/**
 * 写真中心の管理画面（siteDesign = "book"、2026-09-26 作り直し）。
 *
 * - 最初に開くのは「写真」。すべての写真が主役で、シリーズに入っていない写真を
 *   左の列から絞り込める
 * - 右の欄のチェックで、1枚をほかの所属はそのままに別のシリーズへも入れられる
 * - 写真を左のシリーズへドラッグすると、そのシリーズに入る
 * - ドラッグでサイトの並びを変えられる
 * - シリーズの画面の「写真の一覧から加える」で、写真の一覧から選んで入れられる
 *
 * 書き込みはこの spec の中で受け止め（送られた中身を確かめる）、DB には書かない。
 */

type Captured = { url: string; body: unknown };

async function openStudio(page: Page, api: SmokeApi) {
  const writes: Captured[] = [];
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.request().method() !== "GET"
      ? route.fallback()
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...settings, siteDesign: "book" }),
        }),
  );
  await page.route(/\/api\/admin\/(series\/\d+\/photos(\/reorder)?|photos\/reorder|photos\/batch)$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    writes.push({ url: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await loginAsAdmin(page);
  await page.goto("/admin");
  await expect(page.locator(".st-workspace")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".st-tile").first()).toBeVisible();
  return writes;
}

test.describe("写真中心の管理画面", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, "PC 幅の操作（ドラッグ）を確かめる");

  test("最初は「写真」。シリーズに入っていない写真を絞り込める", async ({ page, api }) => {
    await openStudio(page, api);
    await expect(page.getByRole("button", { name: "写真", exact: true })).toHaveAttribute("aria-current", "page");
    const loose = page.locator(".st-side__item", { hasText: "シリーズに入っていない" });
    const count = Number(await loose.locator(".st-side__count").textContent());
    await loose.click();
    await expect(page.locator(".st-toolbar__title h2")).toHaveText("シリーズに入っていない写真");
    await expect(page.locator(".st-tile")).toHaveCount(count);
    // 人工データ: 7001〜7009 のうちゴミ箱以外で、どのシリーズにも入っていない写真
    await expect(page.locator('.st-tile[data-photo-id="7101"]')).toHaveCount(0);
    await expect(page.locator('.st-tile[data-photo-id="7001"]')).toHaveCount(1);
  });

  test("右の欄のチェックで、ほかの所属はそのままに別のシリーズへも入れる", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.locator('.st-tile[data-photo-id="7101"]').click();
    const checks = page.locator(".st-inspector .st-check", { hasText: "港の光" });
    await expect(checks.locator("input")).toBeChecked();
    await page.locator(".st-inspector .st-check", { hasText: "写真のない組" }).locator("input").click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ url: "/api/admin/series/503/photos", body: { add: [7101] } });
    await expect(page.locator(".st-toast")).toContainText("に入れました");
  });

  test("写真を左のシリーズへドラッグすると、そのシリーズに入る", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page
      .locator('.st-tile[data-photo-id="7001"]')
      .dragTo(page.locator(".st-side__item", { hasText: "港の光" }));
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ url: "/api/admin/series/501/photos", body: { add: [7001] } });
  });

  test("ドラッグでサイトの並びを変える", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    const tiles = page.locator(".st-tile");
    const ids = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-id"))));
    await tiles.nth(0).dragTo(tiles.nth(3), { targetPosition: { x: 4, y: 20 } });
    await expect.poll(() => writes.length).toBe(1);
    const body = writes[0]!.body as { ids: number[]; expectedIds: number[] };
    expect(writes[0]!.url).toBe("/api/admin/photos/reorder");
    // 先頭の写真が、4枚目の前（3番目）へ
    expect(body.ids.slice(0, 4)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    expect(body.expectedIds.slice(0, 4)).toEqual(ids.slice(0, 4));
  });

  test("シリーズの画面で、写真の一覧から選んで加える", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.getByRole("button", { name: "シリーズ", exact: true }).click();
    await page.locator(".st-side__item--series", { hasText: "港の光" }).click();
    await expect(page.locator(".st-title-input")).toHaveValue("港の光");
    // 加える入口は2つ（パソコンから取り込む／写真の一覧から加える、2026-09-30）。
    await page.getByRole("button", { name: "写真の一覧から加える" }).click();
    const dialog = page.locator("dialog.st-dialog[open]");
    await expect(dialog).toBeVisible();
    await dialog.locator('.st-tile[data-photo-id="7001"]').click();
    await dialog.locator('.st-tile[data-photo-id="7004"]').click();
    await dialog.getByRole("button", { name: "2枚を加える" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]!.url).toBe("/api/admin/series/501/photos");
    expect((writes[0]!.body as { add: number[] }).add.sort()).toEqual([7001, 7004]);
  });

  // 2026-10-01: シリーズの画面で「パソコンから取り込む」に登録済みの写真を選ぶと、以前は
  // 「すでに登録されています」と出るだけで、そのシリーズには入らなかった。
  test("シリーズの画面から登録済みの写真を取り込むと、そのシリーズに入る", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.route("**/api/admin/upload", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ duplicate: true, photoId: 7001 }) }),
    );
    await page.getByRole("button", { name: "シリーズ", exact: true }).click();
    await page.locator(".st-side__item--series", { hasText: "写真のない組" }).click();
    await expect(page.locator(".st-title-input")).toHaveValue("写真のない組");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "パソコンから取り込む" }).click();
    await (await chooser).setFiles({ name: "already.jpg", mimeType: "image/jpeg", buffer: Buffer.from("already") });
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ url: "/api/admin/series/503/photos", body: { add: [7001] } });
    await expect(page.locator(".st-toast")).toContainText("登録済みの1枚をこのシリーズに入れました");
  });

  test("サイト › シリーズの中の並びに、この構成で使わない設定を書く", async ({ page, api }) => {
    test.skip(!BOOK_DESIGN_ENABLED, "写真中心の骨格だけの一言（2026-09-30 に骨格を止めた）");
    await openStudio(page, api);
    await page.getByRole("navigation", { name: "管理画面の入口" }).getByRole("button", { name: "サイト" }).click();
    // サイトの画面（2026-09-29〜）: Gallery の「並び順」を開く。
    await openSitePart(page, "order", { page: "gallery" });
    const note = page.locator(".admin-book-unused");
    await expect(note).toBeVisible();
    await expect(note).toContainText("Gallery にはいつもすべての公開写真");
    await openSitePart(page, "theme", { mode: "look" });
    await expect(page.locator('[data-settings-section="theme"]')).toBeVisible();
    await expect(note).toHaveCount(0);
  });
});

// 2026-10-01: スマホで「まとめて選ぶ」と、1枚押すたびに画面の7割を覆う欄が開き、
// 2枚目を押せなかった。選んでいる間は下の1行（N枚を選んでいます・操作する）にたたむ。
test.describe("写真中心の管理画面（スマホ）", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 9999) > 760, "スマホ幅の欄のたたみ方を確かめる");

  test("まとめて選ぶ間は欄が下の1行にたたまれ、続けて写真を押せる", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    await page.getByRole("button", { name: "まとめて選ぶ" }).click();
    const tiles = page.locator(".st-tile");
    await tiles.nth(1).click();
    const inspector = page.locator(".st-inspector");
    await expect(inspector).toHaveAttribute("data-collapsed", "true");
    await expect(inspector.locator(".st-inspector__count")).toHaveText("1枚を選んでいます");
    // 欄に隠れずに、2枚目・3枚目を押せる
    await tiles.nth(2).click({ timeout: 5000 });
    await tiles.nth(3).click({ timeout: 5000 });
    await expect(inspector.locator(".st-inspector__count")).toHaveText("3枚を選んでいます");
    const box = await inspector.boundingBox();
    expect(box!.height, "たたんだ欄は1行ぶん").toBeLessThan(100);
    // 「操作する」で広げると、まとめての操作が出る
    await inspector.getByRole("button", { name: "操作する" }).click();
    await expect(inspector).not.toHaveAttribute("data-collapsed");
    await expect(inspector.getByRole("button", { name: "ゴミ箱へ" })).toBeVisible();
    expect(writes).toEqual([]);
  });
});

// 2026-10-02: 並べ替えはドラッグだけで、スマホでは「詳しい道具」の従来の一覧へ行くしかなく、
// PC でも遠くへ動かすには引きずったまま長くスクロールする必要があった。右の欄のボタンで動かす。
test.describe("右の欄の並びのボタン（ドラッグの代わり）", () => {
  test("先頭へで、サイトの並びを変える（スマホでも）", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    const tiles = page.locator(".st-tile");
    const ids = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-id"))));
    await tiles.nth(4).click();
    const inspector = page.locator(".st-inspector");
    // スマホの一覧は見えている所だけ描くので、全体の枚数は画面の数から取らない。
    await expect(inspector.locator(".st-order__pos")).toHaveText(/^5番目 \/ \d+枚$/);
    await inspector.locator(".st-order").getByRole("button", { name: "先頭へ", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]!.url).toBe("/api/admin/photos/reorder");
    const body = writes[0]!.body as { ids: number[]; expectedIds: number[] };
    expect(body.ids.slice(0, 5)).toEqual([ids[4], ids[0], ids[1], ids[2], ids[3]]);
    expect(body.expectedIds.slice(0, 5)).toEqual(ids.slice(0, 5));
  });

  test("シリーズの画面では、1つ前へでシリーズの中の並びを変える", async ({ page, api }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1000, "シリーズの画面の開き方は PC 幅で確かめる");
    const writes = await openStudio(page, api);
    await page.getByRole("button", { name: "シリーズ", exact: true }).click();
    await page.locator(".st-side__item--series", { hasText: "港の光" }).click();
    await expect(page.locator(".st-title-input")).toHaveValue("港の光");
    const tiles = page.locator(".st-workspace--series .st-tile");
    const inSeries = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-id"))));
    await tiles.nth(1).click();
    const inspector = page.locator(".st-inspector");
    await expect(inspector.locator(".st-section__title", { hasText: "シリーズの中の並び" })).toBeVisible();
    await expect(inspector.locator(".st-order__pos")).toHaveText(`2番目 / ${inSeries.length}枚`);
    await inspector.locator(".st-order").getByRole("button", { name: "1つ前へ", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]!.url).toBe("/api/admin/series/501/photos/reorder");
    const order = (writes[0]!.body as { ids: number[] }).ids;
    expect(order.indexOf(inSeries[1]!)).toBeLessThan(order.indexOf(inSeries[0]!));
  });
});

// 2026-10-02: 右の欄を開いたまま隣の写真へ移れなかった（閉じて押し直す。スマホでは欄が
// 画面の大半を覆う）。「‹ 前・次 ›」と、PC では ←→ で移る。
// 2026-10-05: 大きさ・幅・絞り込みが変わって写真が別の段へ移ると、タイルごと作り直されて
// いた（段ごとの入れ子の中でしか key が効かない）。作り直された画像は一度空になり、大きさを
// 変えたときは新しい大きさの画像が届くまで空のままだった。右の欄の写真は高さが決まって
// おらず、届いた瞬間に下の欄を押し下げていた。
test.describe("一覧の写真は作り直されず、右の欄は場所を先に取る", () => {
  test("大きさを変えても、写真は同じ要素のまま", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅で確かめる");
    await openStudio(page, api);
    const tiles = page.locator(".st-tile");
    const count = await tiles.count();
    await tiles.evaluateAll((els) =>
      els.forEach((el) => {
        (el as HTMLElement).dataset.sameTile = "yes";
      }),
    );
    await page.getByRole("button", { name: "大", exact: true }).click();
    await expect
      .poll(() => tiles.first().evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(200);
    // 画面に残っている写真は、どれも作り直されていない（印が残っている）。
    const kept = await tiles.evaluateAll(
      (els) => els.filter((el) => (el as HTMLElement).dataset.sameTile === "yes").length,
    );
    expect(kept).toBe(Math.min(count, await tiles.count()));
    expect(kept).toBeGreaterThan(3);
  });

  test("右の欄の写真は、届く前から高さを持つ", async ({ page, api }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "PC幅で確かめる");
    await openStudio(page, api);
    // 大きい画像は届かせない。それでも枠の高さが取れていること。
    await page.route("**/*", (route) =>
      /medium|w=1200/.test(route.request().url()) ? new Promise(() => {}) : route.fallback(),
    );
    await page.locator(".st-tile").nth(1).click();
    const preview = page.locator(".st-preview__img");
    await expect(preview).toBeVisible();
    const box = await preview.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { height: el.getBoundingClientRect().height, underlay: cs.backgroundImage };
    });
    expect(box.height, "届く前の枠に高さが無い").toBeGreaterThan(80);
    expect(box.underlay, "下に敷く小さい画像が無い").toContain("url(");
  });
});

test.describe("右の欄の「前・次」", () => {
  test("開いたまま隣の写真へ移り、端では押せない", async ({ page, api }) => {
    const writes = await openStudio(page, api);
    const tiles = page.locator(".st-tile");
    const ids = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-id"))));
    await tiles.nth(0).click();
    const inspector = page.locator(".st-inspector");
    const prev = inspector.getByRole("button", { name: "前の写真" });
    const next = inspector.getByRole("button", { name: "次の写真" });
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(page.locator(`.st-tile[data-photo-id="${ids[1]}"]`)).toHaveAttribute("data-selected", "true");
    await expect(page.locator(".st-tile[data-selected]")).toHaveCount(1);
    if ((page.viewportSize()?.width ?? 0) >= 1000) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator(`.st-tile[data-photo-id="${ids[2]}"]`)).toHaveAttribute("data-selected", "true");
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator(`.st-tile[data-photo-id="${ids[1]}"]`)).toHaveAttribute("data-selected", "true");
    }
    await prev.click();
    await expect(prev).toBeDisabled();
    expect(writes).toEqual([]);
  });
});
