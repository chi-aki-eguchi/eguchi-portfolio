import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";

/**
 * 新しい構成（siteDesign = "develop"、2026-10-10 第1段階）。
 *
 * 1. 何もしなければ今までの構成のまま（メニューも、`/portrait` が無いことも）
 * 2. 住所に `?design=develop` を付けたタブだけ、新しい構成になる：
 *    メニューが Portrait／Life／Series／Info、トップが表紙と扉の目次
 * 3. Portrait／Life は分類から写真が出て、押すといつものビューアが開く
 * 4. Info は自己紹介と依頼（今までの About と Contact の中身）
 * 5. 今までのページ（Gallery・Series・About・Contact・英語・方針）も、同じ住所で開ける
 * 6. `?design=classic` で下見をやめられる
 *
 * 人工データの写真へ、この spec の中だけ分類を付けて見る（保存はしない）。
 */
type Photo = Record<string, unknown> & { id: number };

async function withCategories(page: Page, api: SmokeApi): Promise<Photo[]> {
  const data = (await (await api.get("/api/photos")).json()) as { photos: Photo[] };
  const photos = data.photos.map((p, i) => ({
    ...p,
    category: i < 5 ? "portrait" : i < 9 ? "life" : i < 11 ? "nature" : "",
  }));
  await page.route(
    (url) => url.pathname === "/api/photos",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...data, photos }),
      }),
  );
  return photos;
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const menuHrefs = (page: Page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll<HTMLAnchorElement>("header a[href], nav a[href]")].map((a) => a.getAttribute("href")!),
    ),
  ]);

test("新しい構成 › 何もしなければ今までの構成のまま", async ({ page, api }) => {
  await withCategories(page, api);
  await page.goto("/", { waitUntil: "networkidle" });
  const hrefs = await menuHrefs(page);
  expect(hrefs).toContain("/about");
  expect(hrefs).toContain("/contact");
  expect(hrefs).not.toContain("/portrait");
  expect(hrefs).not.toContain("/info");
  await expect(page.locator(".dv-home")).toHaveCount(0);
  for (const path of ["/portrait", "/life", "/info"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" })).toBeVisible();
  }
});

test("新しい構成 › 下見の住所で、メニュー・表紙・扉の目次が出る", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toBeVisible();
  const hrefs = await menuHrefs(page);
  for (const href of ["/portrait", "/life", "/info"]) expect(hrefs).toContain(href);
  expect(hrefs).not.toContain("/about");
  expect(hrefs).not.toContain("/contact");
  // 下見の間は検索に載せない。
  await expect(page.locator('meta[name="robots"][data-design-preview]')).toHaveAttribute("content", "noindex");

  // 表紙は最初の画面に収まり、写真が出ている。
  const cover = page.locator(".dv-cover__photo[data-on] img");
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const frame = await page.locator(".dv-cover__frame").boundingBox();
  const viewport = page.viewportSize()!;
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(frame!.height).toBeGreaterThan(300);

  // 扉は Portrait・Life・（Series）・Info の順。
  const doors = await page.locator(".dv-door").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(doors[0]).toBe("/portrait");
  expect(doors[1]).toBe("/life");
  expect(doors[doors.length - 1]).toBe("/info");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-home.png"), fullPage: true });
});

test("新しい構成 › Portrait と Life は分類から出て、押すとビューアが開く", async ({ page, api }, testInfo) => {
  const photos = await withCategories(page, api);
  // Gallery を「ランダム」にしているサイトでも、Portrait／Life の並びは開くたびに変わらない（管理画面で決めた順）。
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, gallerySortOrder: "random" }),
    }),
  );
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await page.locator('.dv-door[href="/portrait"]').click();
  await expect(page).toHaveURL(/\/portrait$/);
  await expect(page.getByRole("heading", { level: 1, name: "Portrait" })).toBeVisible();
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  const shown = () =>
    page.locator(".ps-tile__button").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-tile"))));
  const firstOrder = await shown();
  const manual = photos
    .filter((p) => p.category === "portrait")
    .map((p, i) => ({ id: p.id, order: Number((p as { sortOrder?: number }).sortOrder ?? 0), i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((p) => p.id);
  expect(firstOrder).toEqual(manual);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  expect(await shown()).toEqual(firstOrder);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-portrait.png"), fullPage: true });

  await page.locator(".ps-tile__button").first().click();
  const viewer = page.locator("dialog[open]");
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  // 下見はページを移っても続く（住所に印が無くても）。
  await page.goto("/life", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Life" })).toBeVisible();
  await expect(page.locator(".ps-tile")).toHaveCount(6);
});

test("新しい構成 › 選んだ写真があれば、分類に関係なく、選んだ順で出る", async ({ page, api }) => {
  const photos = await withCategories(page, api);
  // 分類の無い写真（11枚目以降）を2枚と、分類 life の1枚を、この順で Portrait に選ぶ。
  const picked = [photos[12]!.id, photos[6]!.id, photos[11]!.id];
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, developPortraitIds: picked.join(","), developLifeIds: "" }),
    }),
  );
  await page.goto("/portrait?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(3);
  const shown = await page
    .locator(".ps-tile__button")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-photo-tile"))));
  expect(shown).toEqual(picked);
  // 選んでいない Life は、今までどおり分類から出る。
  await page.goto("/life", { waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(6);
});

test("新しい構成 › 写真は幅を使い切り、余白は区切りにだけ使う", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  // 余白の設定を詰めたサイト（オーナーの本番と同じ 0.2）。新しいページもその設定に従う。
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...settings,
        pageTitleStyle: "hidden",
        spacingHeroBottom: "0.2",
        spacingSectionGap: "0.2",
        spacingPageTop: "0.2",
        seriesLayout: "editorial",
        seriesCardStyle: "overlay",
        homeCtaEnabled: "on",
        homeCtaText: "ポートレート撮影 60分 ¥10,000。学生の方は半額です。",
      }),
    }),
  );
  const phone = page.viewportSize()!.width < 640;
  await page.goto("/portrait?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  const list = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll<HTMLElement>(".ps-tile")].map((t) => t.getBoundingClientRect());
    const box = document.querySelector(".ps-stream")!.getBoundingClientRect();
    const tops = [...new Set(tiles.map((r) => Math.round(r.top)))].sort((a, b) => a - b);
    const rows = tops.map((top) => tiles.filter((r) => Math.round(r.top) === top));
    const header = [...document.querySelectorAll<HTMLElement>("header")].find((h) => getComputedStyle(h).position === "fixed");
    return {
      vw: document.documentElement.clientWidth,
      boxLeft: Math.round(box.left),
      boxRight: Math.round(box.right),
      firstTop: Math.round(tiles[0]!.top - (header ? header.getBoundingClientRect().bottom : 0)),
      // 段ごとの右端と、次の段までの間
      rights: rows.map((r) => Math.round(Math.max(...r.map((x) => x.right)))),
      gaps: rows.slice(1).map((r, i) => Math.round(r[0]!.top - Math.max(...rows[i]!.map((x) => x.bottom)))),
      perRow: rows.map((r) => r.length),
    };
  });
  // どの段も、並べる幅の右端までそろう（横に空きを残さない）。段の間は写真の間と同じ狭さ。
  for (const right of list.rights) expect(Math.abs(right - list.boxRight)).toBeLessThanOrEqual(1);
  for (const gap of list.gaps) expect(gap).toBeLessThanOrEqual(12);
  if (phone) {
    // スマホ：写真は画面の端から端まで。見出しを出さない設定なら、写真は上の帯のすぐ下から。
    expect(list.boxLeft).toBe(0);
    expect(list.boxRight).toBe(list.vw);
    expect(Math.max(...list.perRow)).toBeLessThanOrEqual(2);
    expect(list.firstTop).toBeLessThanOrEqual(16);
  }
  // 撮影依頼の文：金額は途中で折れない（「¥10,／000。」になっていた）。
  const price = page.locator(".inquiry-note .ja-phrase", { hasText: "¥10,000" });
  await expect(price).toHaveCount(1);
  expect(await price.evaluate((el) => el.getClientRects().length)).toBe(1);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-portrait-rows.png"), fullPage: true });

  // トップ：表紙の下と扉の下の余白は、設定に従って詰まる。
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toBeVisible();
  const home = await page.evaluate(() => {
    const r = (q: string) => document.querySelector(q)?.getBoundingClientRect() ?? null;
    const cover = r(".dv-cover")!;
    const doors = r(".dv-doors")!;
    const frame = r(".dv-cover__frame")!;
    const archive = r(".dv-archive");
    const note = r(".inquiry-note");
    const list = r(".dv-doors__list")!;
    const stage = r(".dv-stage");
    const doorEls = [...document.querySelectorAll<HTMLElement>(".dv-door")];
    return {
      vw: document.documentElement.clientWidth,
      coverToDoors: Math.round(doors.top - cover.bottom),
      doorsToArchive: archive ? Math.round(archive.top - doors.bottom) : 0,
      frameLeft: Math.round(frame.left),
      frameRight: Math.round(frame.right),
      archiveLeft: archive ? Math.round(archive.left) : null,
      archiveUnderline: getComputedStyle(document.querySelector(".dv-archive__link") ?? document.body).borderBottomWidth,
      noteLeft: note ? Math.round(note.left) : null,
      listBox: [Math.round(list.top), Math.round(list.bottom)],
      stageBox: stage && stage.height > 0 ? [Math.round(stage.top), Math.round(stage.bottom)] : null,
      // 扉ごと：写真の左右、写真の下→名前、名前→次の扉の写真
      doors: doorEls.map((el, i) => {
        const photo = el.querySelector(".dv-door__photo")?.getBoundingClientRect();
        const title = el.querySelector(".dv-door__title")!.getBoundingClientRect();
        const next = doorEls[i + 1]?.querySelector(".dv-door__photo")?.getBoundingClientRect();
        return {
          shown: Boolean(photo && photo.height > 0),
          left: photo ? Math.round(photo.left) : null,
          right: photo ? Math.round(photo.right) : null,
          toName: photo ? Math.round(title.top - photo.bottom) : null,
          toNext: next && next.height > 0 ? Math.round(next.top - title.bottom) : null,
          line: getComputedStyle(el).borderBottomWidth,
        };
      }),
    };
  });
  expect(home.coverToDoors).toBeLessThanOrEqual(24);
  expect(home.doorsToArchive).toBeLessThanOrEqual(40);
  // 「すべての写真」は下線でなく矢印（すぐ下の帯の罫と二重線にしない）。帯は左端をそろえる。
  if (home.archiveLeft !== null) {
    expect(home.archiveUnderline).toBe("0px");
    await expect(page.locator(".dv-archive__arrow")).toBeVisible();
    if (home.noteLeft !== null) expect(Math.abs(home.noteLeft - home.archiveLeft)).toBeLessThanOrEqual(1);
  }
  if (phone) {
    // スマホ：表紙も扉の写真も端から端まで。名前は自分の写真の近く、次の扉とは離す（罫は引かない）。
    expect(home.frameLeft).toBe(0);
    expect(home.frameRight).toBe(home.vw);
    const shown = home.doors.filter((d) => d.shown);
    expect(shown.length).toBeGreaterThan(0);
    for (const door of shown) {
      expect(door.left).toBe(0);
      expect(door.right).toBe(home.vw);
      expect(door.line).toBe("0px");
      if (door.toNext !== null) expect(door.toNext).toBeGreaterThanOrEqual(door.toName! + 8);
    }
  } else if (home.stageBox) {
    // 広い画面：扉の一覧と隣の写真は、上も下もそろう（一覧の下だけ空かない）。
    expect(Math.abs(home.listBox[0]! - home.stageBox[0]!)).toBeLessThanOrEqual(2);
    expect(Math.abs(home.listBox[1]! - home.stageBox[1]!)).toBeLessThanOrEqual(2);
  }
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-home-spacing.png"), fullPage: true });

  if (phone) {
    // シリーズの一覧：表紙も端から端まで（題名を表紙に重ねる札）。
    await page.goto("/series", { waitUntil: "networkidle" });
    const cards = page.locator("a[href^='/series/'] .series-card-media");
    if ((await cards.count()) > 1) {
      const edges = await cards.evaluateAll((els) => {
        const rects = els.map((e) => e.getBoundingClientRect());
        return [Math.round(Math.min(...rects.map((r) => r.left))), Math.round(Math.max(...rects.map((r) => r.right)))];
      });
      expect(edges[0]).toBe(0);
      expect(edges[1]).toBe(home.vw);
      expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    }
    // シリーズのページ（editorial）：対の2枚目も最後の1枚も画面の幅いっぱい。写真の間はどこも同じ狭さ。
    const series = ((await (await api.get("/api/series")).json()) as { series: { slug: string }[] }).series;
    if (series.length > 0) {
      await page.goto(`/series/${series[0]!.slug}`, { waitUntil: "networkidle" });
      await expect(page.locator("[data-photo-sequence] img").first()).toBeVisible();
      const seq = await page.locator("[data-photo-sequence] .photo-card").evaluateAll((els) => {
        const rects = els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        return {
          widths: rects.map((r) => Math.round(r.width)),
          gaps: rects.slice(1).map((r, i) => Math.round(r.top - rects[i]!.bottom)),
        };
      });
      expect(seq.widths.length).toBeGreaterThan(0);
      for (const w of seq.widths) expect(w).toBeGreaterThanOrEqual(home.vw - 1);
      for (const gap of seq.gaps) expect(gap).toBeLessThanOrEqual(8);
      expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    }

    // メニュー：扉の行が画面の高さを均等に分け合い、下に空きを残さない（以前は上に寄って、下6割が空いていた）。
    await page.goto("/life", { waitUntil: "networkidle" });
    await page.locator('button[aria-controls="mobile-menu"]:visible').first().click();
    const doorRows = page.locator("#mobile-menu .public-mobile-menu__link[data-door]");
    await expect(doorRows.first()).toBeVisible();
    await expect(page.locator('#mobile-menu a[href="/life"]')).toHaveAttribute("aria-current", "page");
    // 項目が下りてくる動きが終わるまで待つ。
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#mobile-menu > *")].every((e) => e.getAnimations().every((a) => a.playState === "finished")),
    );
    const menu = await page.evaluate(() => {
      const box = document.querySelector("#mobile-menu")!;
      const b = box.getBoundingClientRect();
      const rows = [...box.querySelectorAll<HTMLElement>(".public-mobile-menu__link[data-door]")].map((e) => e.getBoundingClientRect());
      const last = Math.max(...[...box.children].map((e) => e.getBoundingClientRect().bottom));
      return {
        heights: rows.map((r) => Math.round(r.height)),
        notes: box.querySelectorAll(".public-mobile-menu__link[data-door] .public-mobile-menu__note").length,
        top: Math.round(rows[0]!.top - b.top),
        deadBelow: Math.round(b.bottom - last),
        menuHeight: Math.round(b.height),
        bottomToScreen: Math.round(innerHeight - b.bottom),
      };
    });
    expect(menu.heights.length).toBeGreaterThanOrEqual(3);
    expect(menu.notes).toBe(menu.heights.length);
    expect(Math.max(...menu.heights) - Math.min(...menu.heights)).toBeLessThanOrEqual(1);
    expect(Math.min(...menu.heights)).toBeGreaterThanOrEqual(72);
    expect(menu.top).toBeLessThanOrEqual(2);
    expect(menu.deadBelow).toBeLessThanOrEqual(24);
    expect(Math.abs(menu.bottomToScreen)).toBeLessThanOrEqual(2);
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("develop-menu.png") });
  }
});

test("新しい構成 › Info は自己紹介と依頼。今までのページも同じ住所で開ける", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  await page.goto("/info?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-info .profile-page")).toBeVisible();
  // 依頼の部分は今までの Contact そのもの（フォームを出すかどうかは今までの設定に従う）。
  await expect(page.locator(".dv-info .contact-page")).toBeVisible();
  // 1ページとして読めること：h1 は1つだけ。すぐ下に依頼の欄があるので、自己紹介の末尾の案内は出さない。
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator(".dv-info .profile-page .inquiry-note")).toHaveCount(0);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("develop-info.png"), fullPage: true });

  for (const [path, ready] of [
    ["/gallery", "main .photo-card"],
    ["/series", "main h1"],
    ["/about", "main .profile-page"],
    ["/contact", "main .contact-page"],
    ["/en/contact", "main .contact-page"],
    ["/privacy", "main h1"],
  ] as const) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator(ready).first(), path).toBeVisible();
    expect(await menuHrefs(page), path).toContain("/portrait");
    await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" }), path).toHaveCount(0);
  }
});

test("新しい構成 › ?design=classic で下見をやめられる", async ({ page, api }) => {
  await withCategories(page, api);
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toBeVisible();
  await page.goto("/?design=classic", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-home")).toHaveCount(0);
  expect(await menuHrefs(page)).toContain("/about");
  await page.goto("/portrait", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "ページが見つかりませんでした" })).toBeVisible();
});
