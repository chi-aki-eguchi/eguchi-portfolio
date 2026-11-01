import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";

/**
 * トップの展示（shared/exhibition.ts）。人工データの上で、設定だけこの spec の中で差し替えて見る（保存はしない）。
 *
 * 1. 会場の壁の配置から始まり、同じ順に切り抜かない写真が続き、最後が縦書きの詩と名刺、言葉の目次
 *    開いた瞬間は名刺で始まり、壁の札まで戻る
 * 2. 同梱の写真が、いつもの画像の経路（/api/images/…）で配信される
 * 3. 押すといつものビューアが、その写真から順に開く
 * 4. 5枚から外すと1枚の表紙になる。写真・文を足すと出る。書いていない文の場所は取らない
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
          profileTwitter: "https://x.com/example_user",
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

test("展示のトップ › 会場の壁の配置から始まり、同じ順に写真が続いて、最後が詩", async ({ page, api }) => {
  await withSettings(page, api, {});
  await page.goto("/", { waitUntil: "networkidle" });

  // 最初の画面は壁。額が5つ、会場と同じ順で、画像が届いている。
  const frames = page.locator(".ex-wall__frame");
  await expect(frames).toHaveCount(5);
  const wallOrder = await page.locator("img.ex-wall__img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).map((img) => [
      (img.currentSrc || img.src).match(/2026-nichigei\/(\w+)\.jpg/)?.[1],
      img.naturalWidth > 0,
    ]),
  );
  expect(wallOrder).toEqual([
    ["grass", true],
    ["flowers", true],
    ["room", true],
    ["back", true],
    ["hair", true],
  ]);
  // 写真の上に文字を重ねない。名前と展示の名前は札にある。
  await expect(page.locator(".hero-single")).toHaveCount(0);
  await expect(page.locator(".ex-label h1")).toBeVisible();
  await expect(page.locator(".ex-label__show")).toContainText("無題");
  await expect(page.locator(".ex-label__show")).toContainText("日藝祭 2026年11月1日〜3日");

  // 続く写真は枠の比が写真の比と同じ（切り抜かれていない）。
  const works = page.locator(".ex-work__open");
  await expect(works).toHaveCount(5);
  const off = await works.evaluateAll((els) =>
    els.filter((el) => {
      const box = el.getBoundingClientRect();
      return Math.abs(box.width / box.height - Number(getComputedStyle(el).getPropertyValue("--ex-ar"))) > 0.02;
    }).length,
  );
  expect(off).toBe(0);

  // 詩は8行の縦書きで、折り返さない。すぐ後に料金の案内を置かない。
  const poem = page.locator("#ex-sheet .ex-poem");
  await expect(poem.locator("span")).toHaveCount(8);
  await expect(poem.locator("span").last()).toHaveText("だけど私のものじゃないの");
  expect(await poem.evaluate((el) => getComputedStyle(el).writingMode)).toBe("vertical-rl");
  await expect(page.locator(".inquiry-note")).toHaveCount(0);

  // 詩の下に名刺の表と裏。裏の QR の場所は、押せる言葉。電話番号とメールは載せない。
  await expect(page.locator(".ex-card")).toHaveCount(2);
  await expect(page.locator(".ex-card__name")).toBeVisible();
  const instagram = page.locator('.ex-card__links a[href="https://www.instagram.com/example_user/"]');
  await expect(instagram).toHaveText("INSTAGRAM");
  await expect(instagram).toHaveAttribute("target", "_blank");
  await expect(page.locator('.ex-card__links a[href="https://x.com/example_user"]')).toHaveText("X");
  await expect(page.locator(".ex-cards")).toContainText("TOKYO / FUKUOKA / TAIPEI");
  await expect(page.locator(".ex-cards")).not.toContainText("@");

  // 続きは言葉の目次。色の写真を挟まない。
  await expect(page.locator(".dv-doors[data-plain]")).toBeVisible();
  await expect(page.locator(".dv-door__photo")).toHaveCount(0);
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});

test("展示のトップ › 開いた瞬間の名刺が壁の札まで戻り、そのあいだに現像が始まって片づく", async ({ page, api }) => {
  await withSettings(page, api, { siteName: "江口秋" });
  await page.goto("/?design=develop&intro", { waitUntil: "commit" });
  const card = page.locator(".dv-intro__card");
  await expect(card).toContainText("江口秋");
  // 名刺が動き出すまでは現像を始めない（紙の裏で終わらないように）。
  await expect(page.locator(".ex-cover")).not.toHaveAttribute("data-on", "");

  // 動き終わりの名刺と札を、退く段取りに入った瞬間に測る。
  const landed = await page.evaluate(
    () =>
      new Promise<{ card: number[]; target: number[] } | null>((resolve) => {
        const intro = document.querySelector<HTMLElement>(".dv-intro");
        if (!intro) return resolve(null);
        const box = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return [r.left, r.top, r.width, r.height];
        };
        const observer = new MutationObserver(() => {
          if (intro.getAttribute("data-phase") !== "out") return;
          observer.disconnect();
          resolve({ card: box(intro.querySelector(".dv-intro__card")), target: box(document.querySelector(".ex-wall__card")) });
        });
        observer.observe(intro, { attributes: true, attributeFilter: ["data-phase"] });
        setTimeout(() => resolve(null), 9000);
      }),
  );
  expect(landed, "名刺が戻って退く段取りまで進む").not.toBeNull();
  landed!.card.forEach((value, i) => expect(Math.abs(value - landed!.target[i]!)).toBeLessThanOrEqual(1.5));
  await expect(page.locator(".ex-cover")).toHaveAttribute("data-on", "");
  await expect(page.locator(".dv-intro")).toHaveCount(0);
  await expect(page.locator(".ex-wall__card").first()).toHaveCSS("opacity", "1");
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});

test("展示のトップ › 同梱の写真は、いつもの画像の経路で配信される", async ({ api }) => {
  const small = await api.get("/api/images/exhibition/2026-nichigei/back.jpg?w=400&q=80&fmt=jpeg");
  expect(small.status()).toBe(200);
  expect(small.headers()["content-type"]).toBe("image/jpeg");
  expect((await api.get("/api/images/exhibition/2026-nichigei/none.jpg")).status()).toBe(404);
});

test("展示のトップ › 壁の写真を押すと、ビューアがその写真から順に開く", async ({ page, api }) => {
  await withSettings(page, api, {});
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator(".ex-wall__frame").first().click();
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
  await expect.poll(shown).toBe("grass");
  await page.keyboard.press("ArrowRight");
  await expect.poll(shown).toBe("flowers");
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
  // 5枚が揃っていないので壁は出さず、先頭が表紙になり、残りが続く。切り抜かない。
  await expect(page.locator(".ex-wall")).toHaveCount(0);
  const cover = page.locator("img.hero-single-img");
  await expect(cover).toHaveAttribute("src", /room\.jpg/);
  expect(await cover.evaluate((img) => getComputedStyle(img).objectFit)).toBe("contain");
  await expect(page.locator(".ex-work__open")).toHaveCount(2);
  // 足したライブラリの写真は、その写真の題がそのまま出る。
  await expect(page.locator(".ex-work__title")).toHaveText(["背中", added.title]);
  await expect(page.locator("#ex-sheet .ex-poem")).toHaveText("展示に添える文。");
});

test("展示のトップ › 紙に収まらない長い文は、横書きで出す", async ({ page, api }) => {
  await withSettings(page, api, { exhibitionText: "長い文章。".repeat(12) });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("#ex-sheet")).toHaveCount(0);
  await expect(page.locator(".ex-works__text")).toBeVisible();
  await expect(page.locator(".ex-wall__sheet")).toHaveCount(0);
});

test("展示のトップ › 題と会期を空にすると、その札を出さない", async ({ page, api }) => {
  await withSettings(page, api, { exhibitionTitle: "", exhibitionDates: "", exhibitionText: "" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".ex-label h1")).toBeVisible();
  await expect(page.locator(".ex-label__show")).toHaveCount(0);
  await expect(page.locator("#ex-sheet")).toHaveCount(0);
  await expect(page.locator(".ex-wall__sheet")).toHaveCount(0);
});

test("展示のトップ › 止めると、いつものトップに戻る", async ({ page, api }) => {
  await withSettings(page, api, { homeExhibition: "off" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".ex-cover")).toHaveCount(0);
  await expect(page.locator(".ex-works")).toHaveCount(0);
  await expect(page.locator(".dv-doors")).toBeVisible();
  await expect(page.locator(".dv-doors[data-plain]")).toHaveCount(0);
});
