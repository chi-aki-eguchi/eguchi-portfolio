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

async function installMocks(
  page: Page,
  options: { authenticated?: boolean; failSave?: boolean; cover?: number[]; heroMode?: string } = {},
) {
  const settings: Record<string, string> = {
    setupCompleted: "true",
    siteName: "Page photos fixture",
    siteDesign: "classic",
    gallerySortOrder: "manual",
    developPortraitIds: "",
    developLifeIds: "",
    developDoors: "",
    servicePageMode: "off",
    heroMode: options.heroMode ?? "single",
  };
  // 表紙の登録（今までの管理画面の「トップに出す」と同じ API）。呼ばれた順に記録する。
  const row = (photoId: number, i: number) => ({ id: i + 1, photoId, sortOrder: i, focalX: null, focalY: null });
  const hero = { rows: (options.cover ?? []).map(row), calls: [] as string[] };
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
  await page.route("**/api/admin/hero-photos**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") return json({ heroPhotos: hero.rows })(route);
    if (state.failSave) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    if (request.method() === "POST" && path.endsWith("/reorder")) {
      const body = request.postDataJSON() as { photoIds: number[]; expectedIds: number[] };
      hero.calls.push(`並べ替え ${body.photoIds.join(",")} ← ${body.expectedIds.join(",")}`);
      // 本物と同じく、いまの並びと違う前提で来たら受け付けない。
      if (hero.rows.map((r) => r.photoId).join(",") !== body.expectedIds.join(","))
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false }) });
      hero.rows = body.photoIds.map(row);
      return json({ ok: true })(route);
    }
    if (request.method() === "POST") {
      const { photoId } = request.postDataJSON() as { photoId: number };
      hero.calls.push(`足す ${photoId}`);
      hero.rows = [...hero.rows.map((r) => r.photoId), photoId].map(row);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (request.method() === "DELETE") {
      const photoId = Number(path.split("/").pop());
      hero.calls.push(`外す ${photoId}`);
      hero.rows = hero.rows.map((r) => r.photoId).filter((id) => id !== photoId).map(row);
      return json({ ok: true })(route);
    }
    return route.fulfill({ status: 405, contentType: "application/json", body: "{}" });
  });
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
  return { saved, settings, state, hero };
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
    // 「サイトで見る」は、いま並べているページを新しい構成で開く。
    await expect(page.getByRole("link", { name: "サイトで見る ↗" })).toHaveAttribute("href", "/portrait?design=develop");
    // スマホ：写真は早く始まり（説明は畳む）、画面の端から端まで並ぶ。
    if (page.viewportSize()!.width < 640) {
      const grid = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll(".pp-grid .pp-tile")].map((t) => t.getBoundingClientRect());
        return {
          top: Math.round(tiles[0]!.top),
          left: Math.round(Math.min(...tiles.map((r) => r.left))),
          right: Math.round(Math.max(...tiles.map((r) => r.right))),
          vw: innerWidth,
          cols: tiles.filter((r) => Math.abs(r.top - tiles[0]!.top) < 2).length,
        };
      });
      // 戻る・題・サイトで見るは1行。写真は、この人工データ（まだ選んでいない＝案内あり）で 240px より上から。
      expect(grid.top).toBeLessThan(240);
      expect(grid.left).toBe(0);
      expect(grid.right).toBe(grid.vw);
      expect(grid.cols).toBe(3);
    }

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

  test("表紙：選んだ写真を並べ替え・外す・足すと今までの登録へ保存され、出し方を切り替えられる", async ({ page }) => {
    // 9_999_999 は公開していない写真の登録（画面には出ない）。外さず、並びの後ろへ置いておく。
    const hidden = 9_999_999;
    const [a, b] = [PHOTOS[20]!.id, PHOTOS[3]!.id];
    const mocks = await installMocks(page, { cover: [hidden, a, b] });
    await open(page);
    await page.locator('[data-pp-tab="cover"]').click();
    await expect(page.locator('[data-pp-tab="cover"] small')).toHaveText("2");
    await expect.poll(() => shownIds(page)).toEqual([a, b]);
    await expect(page.locator(".pp-note")).toContainText("先頭の写真だけが出ます");
    await expect(page.getByRole("link", { name: "サイトで見る ↗" })).toHaveAttribute("href", "/?design=develop");
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

    // 並べ替え：先頭を最後へ。いまの並び（画面に無い登録も含む）を添えて送る。
    await page.locator(".pp-grid .pp-tile").nth(0).click();
    await page.getByRole("button", { name: "最後へ" }).click();
    await expect.poll(() => mocks.hero.calls).toEqual([`並べ替え ${b},${a},${hidden} ← ${hidden},${a},${b}`]);
    await expect.poll(() => shownIds(page)).toEqual([b, a]);
    await expect(page.locator(".pp-toast[data-show]")).toContainText("並べ替えました");

    // 元に戻す。
    await page.locator(".pp-toast").getByRole("button", { name: "元に戻す" }).click();
    await expect.poll(() => mocks.hero.calls.length).toBe(2);
    await expect.poll(() => shownIds(page)).toEqual([a, b]);

    // 外す：その写真の登録だけを消す（画面に無い登録は残る）。
    await page.getByRole("button", { name: "選択をやめる" }).click();
    await page.locator(".pp-grid .pp-tile").nth(0).click();
    await page.getByRole("button", { name: "外す" }).click();
    await expect.poll(() => mocks.hero.calls.at(-1)).toBe(`外す ${a}`);
    await expect.poll(() => shownIds(page)).toEqual([b]);
    expect(mocks.hero.rows.map((r) => r.photoId)).toContain(hidden);
    await expect(page.locator(".pp-note")).toContainText("この写真が、トップを開いたときの表紙です");

    // 足す：選んだ写真が最後に入る。
    await page.getByRole("button", { name: "写真を足す" }).click();
    const sheet = page.locator(".pp-sheet");
    await sheet.locator('[data-filter="unused"]').click();
    const added = Number(await sheet.locator(".pp-pick").first().getAttribute("data-photo"));
    await sheet.locator(".pp-pick").first().click();
    await sheet.locator("[data-pp-done]").click();
    // 足した写真は登録の最後に入るので、画面に無い登録の前へ来るよう、続けて並べ替える。
    await expect
      .poll(() => mocks.hero.calls.slice(-2))
      .toEqual([`足す ${added}`, `並べ替え ${b},${added},${hidden} ← ${b},${hidden},${added}`]);
    await expect.poll(() => shownIds(page)).toEqual([b, added]);

    // 出し方：1枚 → スライド（今までの設定 heroMode を保存する）。
    await expect(page.locator('[data-pp-cover-mode="single"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-pp-cover-mode="carousel"]').click();
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ heroMode: "carousel" });
    await expect(page.locator('[data-pp-cover-mode="carousel"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".pp-note")).toContainText("この順に入れ替わります");
    // ページの写真（Portrait）は変わっていない。
    await page.locator('[data-pp-tab="portrait"]').click();
    await expect.poll(() => shownIds(page)).toEqual(PORTRAIT);
    expect(mocks.saved.some((body) => "developPortraitIds" in body)).toBe(false);
  });

  test("扉の名前：変えるとその場で保存され、タブの名前も変わる。空にすると初めの名前に戻る", async ({ page }) => {
    // 添え書きは初めは空（2026-10-23）。足したいときだけ書く。
    const mocks = await installMocks(page);
    await open(page);
    const doors = page.locator(".pp-doors");
    // ふだんは畳んである。
    await expect(doors.locator("[data-pp-door-label]").first()).toBeHidden();
    await doors.locator("summary").click();
    const label = doors.locator('[data-pp-door="portrait"] [data-pp-door-label]');
    const note = doors.locator('[data-pp-door="portrait"] [data-pp-door-note]');
    await expect(label).toHaveValue("Portrait");
    await expect(note).toHaveValue("");
    // スマホで押しても画面が拡大しない字の大きさ・押しやすい高さ。
    if (page.viewportSize()!.width < 640) {
      const box = await label.evaluate((el) => ({ font: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height }));
      expect(box.font).toBeGreaterThanOrEqual(16);
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

    // 名前を変える → 欄を出ると保存。変えた扉だけが入る。
    await label.fill("People");
    await label.press("Enter");
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developDoors: JSON.stringify({ portrait: ["People", ""] }) });
    await expect(page.locator('[data-pp-tab="portrait"]')).toContainText("People");
    await expect(page.locator(".pp-toast[data-show]")).toContainText("扉の名前を変えました");

    // 添え書きを足す。
    await note.fill("人を撮る");
    await note.blur();
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developDoors: JSON.stringify({ portrait: ["People", "人を撮る"] }) });

    // 名前を空にして出ると、初めの名前に戻る（名前の無い扉は作らない）。
    const before = mocks.saved.length;
    await label.fill("   ");
    await label.blur();
    await expect(label).toHaveValue("Portrait");
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developDoors: JSON.stringify({ portrait: ["Portrait", "人を撮る"] }) });
    expect(mocks.saved.length).toBe(before + 1);

    // 初めの名前に戻す。
    await doors.getByRole("button", { name: "初めの名前に戻す" }).click();
    await expect.poll(() => mocks.saved.at(-1)).toEqual({ developDoors: "" });
    await expect(note).toHaveValue("");
    await expect(doors.getByRole("button", { name: "初めの名前に戻す" })).toHaveCount(0);
  });

  test("表紙：保存に失敗したら、実際の登録どおりに戻して画面で知らせる", async ({ page }) => {
    const [a, b] = [PHOTOS[20]!.id, PHOTOS[3]!.id];
    const mocks = await installMocks(page, { cover: [a, b], failSave: true });
    await open(page);
    await page.locator('[data-pp-tab="cover"]').click();
    await expect.poll(() => shownIds(page)).toEqual([a, b]);
    await page.locator(".pp-grid .pp-tile").nth(0).click();
    await page.getByRole("button", { name: "最後へ" }).click();
    await expect(page.locator(".pp-error")).toContainText("保存できませんでした");
    await expect.poll(() => shownIds(page)).toEqual([a, b]);
    expect(mocks.hero.rows.map((r) => r.photoId)).toEqual([a, b]);
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
