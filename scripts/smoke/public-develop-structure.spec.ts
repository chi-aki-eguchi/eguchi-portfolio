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

// 開いた瞬間の見せ場（写真集の扉）は、そのタブで最初にトップを開いたときだけ流れ、その回は表紙の
// 「現れる動き」を省く。表紙そのものを確かめる検査は、2度目以降に開いた状態（＝いつもの表紙）で見る。
// 見せ場は、名前に「見せ場」を含む検査で確かめる。
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes("見せ場")) return;
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("dv-intro-seen", "1");
    } catch {
      // 覚えを書けない環境は対象外
    }
  });
});

test("新しい構成 › 何もしなければ今までの構成のまま", async ({ page, api }) => {
  await withCategories(page, api);
  await page.goto("/", { waitUntil: "networkidle" });
  const hrefs = await menuHrefs(page);
  expect(hrefs).toContain("/about");
  expect(hrefs).toContain("/contact");
  expect(hrefs).not.toContain("/portrait");
  expect(hrefs).not.toContain("/info");
  await expect(page.locator(".dv-home")).toHaveCount(0);
  // 現像の現れ方は新しい構成だけ。今までの構成の表紙は今までどおり（下地の像を置かない）。
  await expect(page.locator(".hero-motion-stage").first()).toBeVisible();
  await expect(page.locator(".hero-latent")).toHaveCount(0);
  // 名前の現れ方も今までどおり（にじませない）。
  expect(
    await page.locator(".hero-motion-stage .hero-text-reveal").first().evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("hero-text-in");
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

  // 表紙は今までの構成と同じ部品：写真が出て、名前が入る（ページの h1 はその1つ）。
  const hero = page.locator(".top-page[data-develop-top] .hero-motion-stage");
  await expect(hero).toBeVisible();
  const cover = hero.locator("img").first();
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(hero.locator("h1")).toHaveCount(1);
  expect((await hero.boundingBox())!.height).toBeGreaterThan(200);

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
        // 写真の間隔（オーナーの本番と同じ 0.6）。新しいページの写真の間もこの設定に従う。
        galleryGapScale: "0.6",
        // 表紙の設定（オーナーの本番と同じ：1枚・全画面・名前が先・ゆっくり・送ると沈む）。
        heroMode: "single",
        heroDisplayMode: "fullscreen",
        heroRevealOrder: "text-first",
        heroMotionSpeed: "slow",
        heroScrollEffect: "sink",
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
  // 間の広さは「写真の間隔」の設定どおり（0.6 で、スマホ 6px・PC 12px）。
  for (const gap of list.gaps) expect(gap).toBe(phone ? 6 : 12);
  if (phone) {
    // スマホ：写真は画面の端から端まで。見出しを出さない設定なら、写真は上の帯のすぐ下から。
    expect(list.boxLeft).toBe(0);
    expect(list.boxRight).toBe(list.vw);
    expect(Math.max(...list.perRow)).toBeLessThanOrEqual(2);
    expect(list.firstTop).toBeLessThanOrEqual(16);
  }
  // 一覧の写真は現像されるように現れる：届く前は色の無い薄い像、届いたら色が乗って filter は無くなる。
  const tileFilter = await page.evaluate(() => {
    const probe = document.createElement("img");
    probe.className = "ps-tile__img";
    document.querySelector(".ps-stream")!.appendChild(probe);
    const before = getComputedStyle(probe).filter;
    probe.remove();
    return before;
  });
  expect(tileFilter).toContain("grayscale");
  expect(tileFilter).not.toContain("blur");
  await expect
    .poll(() => page.locator(".ps-tile__img[data-loaded]").first().evaluate((img) => getComputedStyle(img).filter))
    .toBe("none");

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
    const cover = r(".hero-motion-stage")!;
    const doors = r(".dv-doors")!;
    const frame = r(".hero-single")!;
    const name = document.querySelector<HTMLElement>(".hero-motion-stage h1");
    const fx = document.querySelector<HTMLElement>(".hero-fx-layer");
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
      frameBottom: Math.round(frame.bottom),
      vh: innerHeight,
      // 開いた時の動き：名前と写真は「現れる動き」を持つ（動きを減らす設定でなければ）。
      nameAnimation: name ? getComputedStyle(name).animationName : "",
      photoAnimation: getComputedStyle(document.querySelector(".hero-photo-reveal") ?? document.body).animationName,
      hasFxLayer: Boolean(fx),
      h1: document.querySelectorAll("h1").length,
      heroName: name?.textContent?.trim() ?? "",
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
  // 表紙は、管理画面の表紙の設定どおり：全画面・名前入り・現れる動きあり（以前の新しい構成は、
  // 写真だけを置く専用の表紙で、開いても何も起きなかった）。
  expect(home.h1).toBe(1);
  expect(home.heroName.length).toBeGreaterThan(0);
  // 名前は、にじんで現れる（新しい構成）。
  expect(home.nameAnimation).toBe("hero-text-ink");
  expect(home.photoAnimation).not.toBe("none");
  expect(home.hasFxLayer).toBe(true);
  expect(home.frameBottom).toBeLessThanOrEqual(home.vh + 1);
  // 扉の写真も現像されるように現れる：スマホは画面に入ったとき、PC は隣の写真が入れ替わるとき。
  const doorDevelop = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const stage = [...document.querySelectorAll<HTMLElement>(".dv-stage__photo")];
    const on = stage.find((el) => el.hasAttribute("data-on"));
    const off = stage.find((el) => !el.hasAttribute("data-on"));
    const doorPhoto = document.querySelector<HTMLElement>(".dv-door__photo");
    if (doorPhoto && getComputedStyle(doorPhoto).display !== "none") {
      doorPhoto.scrollIntoView({ block: "center" });
      await wait(2200);
    }
    const filter = (el: Element | null | undefined) => (el ? getComputedStyle(el).filter : null);
    return {
      stageOn: filter(on?.querySelector("img")),
      stageOff: filter(off?.querySelector("img")),
      doorShown: doorPhoto ? getComputedStyle(doorPhoto).display !== "none" : false,
      doorVisible: doorPhoto?.classList.contains("visible") ?? false,
      doorFilter: filter(doorPhoto?.querySelector("img")),
    };
  });
  if (phone) {
    expect(doorDevelop.doorShown).toBe(true);
    expect(doorDevelop.doorVisible).toBe(true);
    expect(doorDevelop.doorFilter).toBe("none");
  } else if (doorDevelop.stageOff !== null) {
    expect(doorDevelop.stageOn).toBe("none");
    expect(doorDevelop.stageOff).toContain("grayscale");
  }
  await page.evaluate(() => scrollTo(0, 0));

  // 現像：本物の写真の下に、同じ写真のぼけた単色の像（小さな絵。filter は使わない）が描かれ、
  // 本物はそれより後から濃くなる（表紙の設定「文字が先」の 0.62秒 より後）。
  await expect(page.locator(".hero-latent[data-ready] canvas")).toHaveCount(1);
  const latent = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".hero-latent canvas")!;
    const box = canvas.getBoundingClientRect();
    const sharp = document.querySelector<HTMLElement>(".hero-photo-reveal img")!.getBoundingClientRect();
    const px = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let colour = 0;
    for (let i = 0; i < px.length; i += 4) colour = Math.max(colour, Math.abs(px[i]! - px[i + 2]!));
    return {
      w: canvas.width,
      h: canvas.height,
      filter: getComputedStyle(canvas).filter,
      sameBox: Math.abs(box.width - sharp.width) < 1 && Math.abs(box.height - sharp.height) < 1 && Math.abs(box.left - sharp.left) < 1,
      colour,
      // 隣どうしの点の明るさの差（ぼけていれば小さい。マス目に見えた粗い像では大きかった）。
      step: (() => {
        let worst = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 1; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            worst = Math.max(worst, Math.abs(px[i]! - px[i - 4]!));
          }
        return worst;
      })(),
      sharpDelay: parseFloat(getComputedStyle(document.querySelector(".hero-photo-reveal")!).animationDelay),
      order: Boolean(document.querySelector(".hero-latent ~ .hero-photo-reveal")),
    };
  });
  expect(Math.max(latent.w, latent.h)).toBeGreaterThanOrEqual(64);
  expect(Math.max(latent.w, latent.h)).toBeLessThanOrEqual(200);
  expect(latent.filter).toBe("none");
  expect(latent.sameBox).toBe(true);
  expect(latent.colour).toBeLessThan(48);
  expect(latent.step).toBeLessThan(40);
  expect(latent.order).toBe(true);
  expect(latent.sharpDelay).toBeGreaterThan(0.62);
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

  // 中身が画面より短いページでは、フッターが画面の下端に来る（フッターの下に空きを残さない）。
  await page.goto("/series", { waitUntil: "networkidle" });
  await expect(page.locator("footer")).toBeVisible();
  const tail = await page.evaluate(() => {
    const footer = document.querySelector("footer")!.getBoundingClientRect();
    return {
      belowFooter: Math.round(document.documentElement.scrollHeight - (footer.bottom + scrollY)),
      footerBottom: Math.round(footer.bottom + scrollY),
      vh: innerHeight,
      docH: document.documentElement.scrollHeight,
    };
  });
  // 以前は、短いページでフッターの下に 160px 残っていた。Safari はフッターの下に数 px を足すので、少しだけ許す。
  expect(tail.belowFooter).toBeLessThanOrEqual(20);
  expect(tail.footerBottom).toBeGreaterThanOrEqual(tail.vh - 1);

  // 文のページ（About）：区切りの余白は「セクションの間隔」の設定（ここでは 0.2）に従って詰まる。
  await page.goto("/about", { waitUntil: "networkidle" });
  await expect(page.locator(".profile-page")).toBeVisible();
  const gaps = await page.evaluate(() => {
    const px = (v: string) => Math.round(parseFloat(v));
    const pick = (cls: string, prop: "marginTop" | "paddingTop") =>
      [...document.querySelectorAll<HTMLElement>(`.profile-page [class~="${cls}"]`)]
        .filter((e) => !(cls === "mt-10" && e.classList.contains("pt-6")) && ![...e.classList].some((c) => c.startsWith("md:mt-") || c.startsWith("md:pt-")))
        .map((e) => px(getComputedStyle(e)[prop]));
    return { mt8: pick("mt-8", "marginTop"), mt10: pick("mt-10", "marginTop"), mt12: pick("mt-12", "marginTop"), pt8: pick("pt-8", "paddingTop") };
  });
  for (const v of gaps.mt8) expect(v).toBe(20);
  for (const v of gaps.mt10) expect(v).toBe(24);
  for (const v of gaps.mt12) expect(v).toBe(28);
  for (const v of gaps.pt8) expect(v).toBe(20);
  expect(gaps.mt8.length + gaps.mt10.length + gaps.mt12.length + gaps.pt8.length).toBeGreaterThan(0);

  if (!phone) {
    // PC のシリーズ（editorial）：対は並べる枠の幅を2枚で分け合い、どの写真も窓の高さに収まる。
    // 対と対の間は、対の中の間と同じ（以前は対の間だけ 62px 以上あり、片方を下へずらした分も足されていた）。
    const list = ((await (await api.get("/api/series")).json()) as { series: { slug: string }[] }).series;
    if (list.length > 0) {
      await page.goto(`/series/${list[0]!.slug}`, { waitUntil: "networkidle" });
      await expect(page.locator("[data-photo-sequence] img").first()).toBeVisible();
      const spread = await page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>("[data-photo-sequence] .photo-card")].map((e) => e.getBoundingClientRect());
        // 縦に重なる写真を1つの組として束ねる。
        const rows: DOMRect[][] = [];
        for (const r of cards) {
          const last = rows[rows.length - 1];
          const overlaps = last && last.some((o) => Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.height, r.height) * 0.5);
          if (overlaps) last!.push(r);
          else rows.push([r]);
        }
        const cover = document.querySelector(".series-cover__frame")?.getBoundingClientRect();
        const box = rows.map((row) => ({
          n: row.length,
          left: Math.round(Math.min(...row.map((r) => r.left))),
          right: Math.round(Math.max(...row.map((r) => r.right))),
          top: Math.round(Math.min(...row.map((r) => r.top))),
          bottom: Math.round(Math.max(...row.map((r) => r.bottom))),
          tallest: Math.round(Math.max(...row.map((r) => r.height))),
          inner: row.length === 2 ? Math.round(Math.max(...row.map((r) => r.left)) - Math.min(...row.map((r) => r.right))) : null,
        }));
        return { box, vh: innerHeight, cover: cover ? [Math.round(cover.left), Math.round(cover.right)] : null };
      });
      const pairsOnly = spread.box.filter((b) => b.n === 2);
      expect(pairsOnly.length).toBeGreaterThan(0);
      for (const b of spread.box) expect(b.tallest).toBeLessThanOrEqual(spread.vh - 160 + 2);
      for (const b of pairsOnly) {
        // 2枚とも窓の高さで止まった組だけは、枠より狭くてよい（真ん中に寄せる）。
        const capped = b.tallest >= spread.vh - 160 - 2;
        if (spread.cover && !capped) {
          expect(Math.abs(b.left - spread.cover[0]!)).toBeLessThanOrEqual(2);
          expect(Math.abs(b.right - spread.cover[1]!)).toBeLessThanOrEqual(2);
        }
      }
      const between = spread.box.slice(1).map((b, i) => b.top - spread.box[i]!.bottom);
      const inner = pairsOnly.map((b) => b.inner!);
      for (const g of between) expect(Math.abs(g - inner[0]!)).toBeLessThanOrEqual(2);
      expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: testInfo.outputPath("develop-series-desktop.png"), fullPage: true });
    }
  }

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
      for (const gap of seq.gaps) expect(gap).toBe(6);
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
    // 添え書きは初めは無し（扉の名前だけ。2026-10-23）。
    expect(menu.notes).toBe(0);
    expect(Math.max(...menu.heights) - Math.min(...menu.heights)).toBeLessThanOrEqual(1);
    expect(Math.min(...menu.heights)).toBeGreaterThanOrEqual(72);
    expect(menu.top).toBeLessThanOrEqual(2);
    expect(menu.deadBelow).toBeLessThanOrEqual(24);
    expect(Math.abs(menu.bottomToScreen)).toBeLessThanOrEqual(2);
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("develop-menu.png") });
  }
});

test("新しい構成 › 現像は「動きを減らす」と「写真の現れ方：なし」では出さない", async ({ page, api }) => {
  await withCategories(page, api);
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  const state = { photoRevealEffect: "fade" };
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, heroMode: "single", heroDisplayMode: "fullscreen", ...state }),
    }),
  );
  const look = () =>
    page.evaluate(() => {
      const latent = document.querySelector<HTMLElement>(".hero-latent");
      const reveal = document.querySelector<HTMLElement>(".hero-photo-reveal")!;
      const probe = document.createElement("img");
      probe.className = "ps-tile__img";
      (document.querySelector(".dv-home") ?? document.body).appendChild(probe);
      const tile = getComputedStyle(probe).filter;
      probe.remove();
      return { latent: latent ? getComputedStyle(latent).display : "(無し)", sharp: getComputedStyle(reveal).opacity, tile };
    });

  // 動きを減らす設定：下地の像は出さない。本物の写真は、今までどおり濃さだけで現れて見える。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-photo-reveal")).toBeVisible();
  await expect.poll(async () => (await look()).sharp).toBe("1");
  const reduced = await look();
  expect(reduced.latent).toBe("none");
  expect(reduced.tile).toBe("none");

  // 写真の現れ方「なし」：動きを減らしていなくても、現像はしない。
  await page.emulateMedia({ reducedMotion: "no-preference" });
  state.photoRevealEffect = "none";
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-photo-reveal")).toBeVisible();
  await expect.poll(async () => (await look()).sharp).toBe("1");
  const off = await look();
  expect(off.latent).toBe("none");
  expect(off.tile).toBe("none");
});

/**
 * 1枚表示（ビューア）の現像（2026-10-13）。送った先の写真は、色の無いぼけた像が上に載って出て、
 * 像が薄れて写真が見えてくる。写真の側は動かさない（像の濃さだけを動かす）。
 *
 * 送ってから 1.8 秒ぶん、コマごとに像の状態を書き出す: 「状態:濃さ:絵の幅」（像が無ければ none）。
 * 絵の幅が 300 のままなら、まだ描けていない（canvas の初期の大きさ）。
 */
const stepAndWatch = (page: Page, key: "ArrowRight" | "ArrowLeft") =>
  page.evaluate(async (key) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const log: string[] = [];
    const from = performance.now();
    while (performance.now() - from < 1800) {
      await new Promise((r) => requestAnimationFrame(r));
      const latent = document.querySelector<HTMLCanvasElement>("dialog[open] canvas[data-lb-latent]");
      log.push(
        latent
          ? `${latent.getAttribute("data-lb-latent")}:${Number(getComputedStyle(latent).opacity).toFixed(2)}:${latent.width}`
          : "none",
      );
    }
    return log;
  }, key);

/** 像が描かれた状態で載り、途中で消されずに、濃さ 0 まで薄れたか。 */
function developed(log: string[]): boolean {
  const start = log.findIndex((row) => row.startsWith("latent:1.00:") && !row.endsWith(":300"));
  if (start < 0) return false;
  const rest = log.slice(start);
  if (rest.includes("none")) return false;
  const opacities = rest.map((row) => Number(row.split(":")[1]));
  const rising = opacities.some((value, i) => i > 0 && value > opacities[i - 1]! + 0.01);
  return !rising && rest[rest.length - 1]!.startsWith("clearing:0.00");
}

async function openPortraitViewer(page: Page) {
  await page.locator('.dv-door[href="/portrait"]').click();
  await expect(page).toHaveURL(/\/portrait$/);
  await expect(page.locator(".ps-tile")).toHaveCount(5);
  // 送った先の写真も頁に出ている（下敷きにできる）状態から始める。
  await expect
    .poll(() =>
      page.locator(".ps-tile__img").evaluateAll(
        (imgs) => imgs.filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0).length,
      ),
    )
    .toBeGreaterThanOrEqual(3);
  await page.locator(".ps-tile__button").first().click();
  const viewer = page.locator('dialog[aria-label="写真ビューア"]');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".lb-ghost")).toHaveCount(0);
  return viewer;
}

test("新しい構成 › 1枚表示：ゆっくり送ると現像して出る。押して開いた1枚と、続けて速く送る間は現像しない", async ({
  page,
  api,
}) => {
  await withCategories(page, api);
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  const viewer = await openPortraitViewer(page);
  const latent = viewer.locator("canvas[data-lb-latent]");
  // 頁から運んで開いた1枚は、もう見えていた写真。像へ戻さない。
  await expect(latent).toHaveCount(0);

  // 間を空けて送る。像が間に合わない回（小さい画像が遅れた回）は現像しない作りなので、3 回まで試す。
  const logs: string[][] = [];
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight"] as const) {
    await page.waitForTimeout(1000);
    logs.push(await stepAndWatch(page, key));
    if (developed(logs[logs.length - 1]!)) break;
  }
  expect(
    developed(logs[logs.length - 1]!),
    `ゆっくり送ったら、像が載って薄れる: ${logs.map((log) => [...new Set(log)].join(" ")).join(" ｜ ")}`,
  ).toBe(true);
  // 現像して出した写真には、ぼけた仮の画像を重ねない（像が代わりを務める）。
  await expect(viewer.locator('.lb-content button img[style*="blur"]')).toHaveCount(0);

  // 間を空けて送った直後に、もう一度送る＝探している最中。色の付いた写真をそのまま出す。
  await page.waitForTimeout(1000);
  const quick = await page.evaluate(async () => {
    const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    press();
    await frame();
    await frame();
    const first = document.querySelectorAll("dialog[open] canvas[data-lb-latent]").length;
    press();
    await frame();
    await frame();
    return { first, second: document.querySelectorAll("dialog[open] canvas[data-lb-latent]").length };
  });
  expect(quick.first, "間を空けて送った写真には像が載る").toBe(1);
  expect(quick.second, "続けて送った写真には像を載せない").toBe(0);

  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
});

test("新しい構成 › 1枚表示の現像も「動きを減らす」と「写真の現れ方：なし」では出さない", async ({ page, api }) => {
  await withCategories(page, api);
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  const state = { photoRevealEffect: "fade" };
  await page.route("**/api/settings**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...settings, ...state }) }),
  );
  const neverLatent = async () => {
    const viewer = await openPortraitViewer(page);
    await page.waitForTimeout(1000);
    const log = await stepAndWatch(page, "ArrowRight");
    expect([...new Set(log)]).toEqual(["none"]);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  };

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  await neverLatent();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  state.photoRevealEffect = "none";
  await page.goto("/", { waitUntil: "networkidle" });
  await neverLatent();
});

/**
 * 開いた瞬間の見せ場：写真集の扉（2026-10-14）。紙の上に、表紙の写真の小さな図版と名前が現れ、
 * 図版が表紙いっぱいに引き伸ばされて、片づく。表紙の部品には触らない（上に重ねるだけ）。
 */
async function withCover(page: Page, api: SmokeApi, extra: Record<string, unknown> = {}) {
  await withCategories(page, api);
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  const merged = { ...settings, heroMode: "single", heroDisplayMode: "fullscreen", ...extra };
  await page.route("**/api/settings**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(merged) }),
  );
  return merged as Record<string, string>;
}
/** 見せ場のいまの段取りと、図版・名前・表紙の写真の箱。until を渡すと、その段取りになった瞬間に測る。 */
const introState = (page: Page, until?: string) =>
  page.evaluate(
    (until) =>
      new Promise<{
        phase: string | null;
        stage: { x: number; y: number; w: number; h: number };
        plate: { x: number; y: number; w: number; h: number } | null;
        name: { x: number; y: number; w: number; h: number } | null;
        text: string;
        frame: { x: number; y: number; w: number; h: number } | null;
      } | null>((resolve) => {
        const intro = document.querySelector<HTMLElement>(".dv-intro");
        if (!intro) return resolve(null);
        const box = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        };
        const read = () => ({
          phase: intro.getAttribute("data-phase"),
          stage: box(intro)!,
          plate: box(intro.querySelector(".dv-intro__plate")),
          name: box(intro.querySelector(".dv-intro__name")),
          text: intro.querySelector(".dv-intro__name")?.textContent ?? "",
          frame: box(document.querySelector(".dv-intro-host .hero-fx-layer")),
        });
        if (!until || intro.getAttribute("data-phase") === until) return resolve(read());
        const observer = new MutationObserver(() => {
          if (intro.getAttribute("data-phase") !== until) return;
          observer.disconnect();
          resolve(read());
        });
        observer.observe(intro, { attributes: true, attributeFilter: ["data-phase"] });
        // 片づいてしまったら（段取りを見逃した）、空で返す。
        setTimeout(() => resolve(null), 9000);
      }),
    until,
  );

test("新しい構成 › 見せ場：最初に開いたときだけ流れ、図版が表紙の写真の場所まで引き伸ばされて片づく", async ({
  page,
  api,
}) => {
  const settings = await withCover(page, api);
  await page.goto("/?design=develop", { waitUntil: "commit" });
  const intro = page.locator(".dv-intro");
  await expect(intro).toHaveCount(1);
  // 見せ場の回は、表紙の「現れる動き」を省く印が付く。
  await expect(page.locator(".dv-intro-host")).toHaveAttribute("data-dv-intro", "");

  // 図版が出た時点：名前はサイトの名前、図版は表紙より小さく、図版と名前のまとまりが箱の中にある。
  const shown = (await introState(page, "plate"))!;
  expect(shown, "図版が出る段取りまで進む").not.toBeNull();
  expect(shown.text.replace(/\u00a0/g, " ")).toBe(String(settings.siteName ?? "Photographer Name"));
  expect(shown.plate!.w).toBeLessThan(shown.frame!.w * 0.5);
  expect(shown.plate!.x).toBeGreaterThanOrEqual(shown.stage.x);
  expect(shown.plate!.x + shown.plate!.w).toBeLessThanOrEqual(shown.stage.x + shown.stage.w);
  expect(shown.name!.x + shown.name!.w).toBeLessThanOrEqual(shown.stage.x + shown.stage.w);
  expect(shown.name!.y).toBeGreaterThanOrEqual(shown.stage.y);

  // 引き伸ばしの終わり：図版は表紙の写真の箱と同じ場所・同じ大きさ（そこで下の表紙に替わる）。
  const grown = (await introState(page, "out"))!;
  expect(grown, "引き伸ばしが終わって退く段取りまで進む").not.toBeNull();
  expect(Math.abs(grown.plate!.x - grown.frame!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(grown.plate!.y - grown.frame!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(grown.plate!.w - grown.frame!.w)).toBeLessThanOrEqual(1);
  expect(Math.abs(grown.plate!.h - grown.frame!.h)).toBeLessThanOrEqual(1);
  // 片づいたあと、下にはいつもの表紙がもう出きっている。
  await expect(intro).toHaveCount(0);
  expect(await page.locator(".hero-photo-reveal").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(page.locator(".hero-motion-stage h1")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("dv-intro-seen"))).toBe("1");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

  // 同じタブでもう一度開いても流れない（いつもの表紙の現れ方）。?intro を付けると、もう一度流れる。
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-motion-stage")).toBeVisible();
  await expect(intro).toHaveCount(0);
  await expect(page.locator(".dv-intro-host")).not.toHaveAttribute("data-dv-intro", "");
  await page.goto("/?intro", { waitUntil: "commit" });
  await expect(intro).toHaveCount(1);
});

test("新しい構成 › 見せ場：触ったらすぐ退く。動きを減らす設定・写真の現れ方「なし」・今までの構成では流さない", async ({
  page,
  api,
}) => {
  const state = { photoRevealEffect: "fade" };
  await withCategories(page, api);
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, heroMode: "single", heroDisplayMode: "fullscreen", ...state }),
    }),
  );
  const intro = page.locator(".dv-intro");

  // 流れている途中でキーを押す＝待たせない。0.3 秒ほどで片づく。
  await page.goto("/?design=develop&intro", { waitUntil: "commit" });
  await expect(intro).toHaveCount(1);
  await expect.poll(async () => (await introState(page))?.phase, { timeout: 10_000 }).toMatch(/on|plate/);
  await page.keyboard.press("Shift");
  await expect(intro).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator(".hero-motion-stage")).toBeVisible();

  // 動きを減らす設定。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?intro", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-motion-stage")).toBeVisible();
  await expect(intro).toHaveCount(0);

  // 写真の現れ方「なし」。
  await page.emulateMedia({ reducedMotion: "no-preference" });
  state.photoRevealEffect = "none";
  await page.goto("/?intro", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-motion-stage")).toBeVisible();
  await expect(intro).toHaveCount(0);

  // 今までの構成（下見をやめる）。
  state.photoRevealEffect = "fade";
  await page.goto("/?design=classic&intro", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-motion-stage").first()).toBeVisible();
  await expect(intro).toHaveCount(0);
  await expect(page.locator(".dv-intro-host")).toHaveCount(0);
});

test("新しい構成 › Info は自己紹介と依頼。今までのページも同じ住所で開ける", async ({ page, api }, testInfo) => {
  await withCategories(page, api);
  await page.goto("/info?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator('.dv-info .profile-page[data-profile-part="intro"]')).toBeVisible();
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

test("新しい構成 › Info は、短い自己紹介 → 料金と依頼 → 続き（note の記事・プリント）の順", async ({ page, api }) => {
  await withCategories(page, api);
  // プリントの案内を出す設定にして、自己紹介の「続き」があるサイトを作る。
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...settings, printEnabled: "on", printStoreUrl: "https://example.com/prints" }),
    }),
  );
  await page.goto("/info?design=develop", { waitUntil: "networkidle" });
  await expect(page.locator(".dv-info .contact-page")).toBeVisible();
  await expect(page.locator(".dv-info [data-about-print]")).toBeVisible();
  const order = await page.evaluate(() => {
    const top = (q: string) => {
      const el = document.querySelector(q);
      return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
    };
    return {
      intro: top('.dv-info [data-profile-part="intro"]'),
      contact: top(".dv-info .contact-page"),
      more: top('.dv-info [data-profile-part="more"]'),
      printInIntro: Boolean(document.querySelector('[data-profile-part="intro"] [data-about-print]')),
      printInMore: Boolean(document.querySelector('[data-profile-part="more"] [data-about-print]')),
      h1: document.querySelectorAll("main h1").length,
    };
  });
  // 自己紹介のすぐ後に料金と依頼が来て、プリントの案内はその後。
  expect(order.intro).not.toBeNull();
  expect(order.contact!).toBeGreaterThan(order.intro!);
  expect(order.more!).toBeGreaterThan(order.contact!);
  expect(order.printInIntro).toBe(false);
  expect(order.printInMore).toBe(true);
  expect(order.h1).toBe(1);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);

  // 単独の /about は今までどおり、1つのページに全部（分けない）。
  await page.goto("/about", { waitUntil: "networkidle" });
  await expect(page.locator("main .profile-page")).toHaveCount(1);
  await expect(page.locator("main .profile-page [data-about-print]")).toBeVisible();
  await expect(page.locator("main [data-profile-part]")).toHaveCount(0);
});

test("新しい構成 › 扉の名前を変えると、メニュー・トップの扉・ページの見出しが同じ名前になる", async ({ page, api }) => {
  await withCategories(page, api);
  const settings = (await (await api.get("/api/settings")).json()) as Record<string, unknown>;
  await page.route("**/api/settings**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...settings,
        pageTitleStyle: "default",
        developDoors: JSON.stringify({ portrait: ["People", "ポートレート撮影"], info: ["依頼", ""] }),
      }),
    }),
  );
  const phone = page.viewportSize()!.width < 768;
  await page.goto("/?design=develop", { waitUntil: "networkidle" });
  // トップの扉：名前と添え書き。変えていない Life は初めの値。添え書きを空にした扉は、添え書きを出さない。
  const doors = await page.locator(".dv-door").evaluateAll((els) =>
    els.map((el) => ({
      href: el.getAttribute("href"),
      title: el.querySelector(".dv-door__title")?.textContent?.trim(),
      note: el.querySelector(".dv-door__note")?.textContent?.trim(),
    })),
  );
  expect(doors.find((d) => d.href === "/portrait")).toEqual({ href: "/portrait", title: "People", note: "ポートレート撮影" });
  expect(doors.find((d) => d.href === "/life")).toEqual({ href: "/life", title: "Life", note: undefined });
  expect(doors.find((d) => d.href === "/info")).toEqual({ href: "/info", title: "依頼", note: undefined });
  // メニュー（PC は並んでいる項目、スマホは開いたメニュー）。
  if (phone) {
    await page.locator('button[aria-controls="mobile-menu"]:visible').first().click();
    const menu = page.locator("#mobile-menu");
    await expect(menu.locator('a[href="/portrait"] .public-mobile-menu__label')).toHaveText("People");
    await expect(menu.locator('a[href="/portrait"] .public-mobile-menu__note')).toHaveText("ポートレート撮影");
    await expect(menu.locator('a[href="/info"] .public-mobile-menu__label')).toHaveText("依頼");
    await expect(menu.locator('a[href="/info"] .public-mobile-menu__note')).toHaveCount(0);
  } else {
    await expect(page.locator('header a[href="/portrait"]:visible').first()).toHaveText("People");
    await expect(page.locator('header a[href="/info"]:visible').first()).toHaveText("依頼");
  }
  // ページの見出しも同じ名前。
  await page.goto("/portrait", { waitUntil: "networkidle" });
  await expect(page.locator("main h1")).toHaveText("People");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
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
