import { expect, test, type Page } from "./fixtures.ts";
import { BOOK_DESIGN_ENABLED } from "./site-design.ts";
const intakeOrigin = "https://photo-work-pricing.chi-aki-18.chatgpt.site";
async function mockPublic(page: Page, owner = true) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/settings" ? { siteUrl: owner ? "https://akieguchi.com" : "https://customer.example", siteDesign: "book", siteName: "Local QA", nameJa: "Local QA", servicePageMode: "on", heroMode: "none", homeSections: "[]", contactEmail: "qa@example.invalid" } : path === "/api/photos" ? { photos: [], total: 0 } : path === "/api/series" ? { series: [] } : {};
    await route.fulfill({ json: data });
  });
  await page.route("https://formspree.io/**", route => route.fulfill({ json: { ok: true } }));
}
async function fill(page: Page) {
  await page.getByLabel("お名前", { exact: false }).fill("[LOCAL TEST] 統合確認");
  await page.getByLabel("メールアドレス", { exact: false }).fill("qa@example.invalid");
  await page.getByLabel("使う目的・相談したいこと", { exact: false }).fill("隔離テスト専用。実顧客・実注文ではありません。");
  await page.locator('input[name="consent"]').check();
}
test("one pricing page selects a plan and the native consultation remains within the site", async ({ page }, info) => {
  await mockPublic(page);
  await page.goto("/portfolio-kit#pricing");
  const pricing = page.locator('[data-portfolio-pricing="unified"]');
  await expect(pricing).toContainText("30,000");
  await expect(pricing).toContainText("69,800");
  await expect(page.locator('[data-studio-bridge="service"]')).toHaveCount(0);
  await pricing.locator('a[href="/portfolio-kit/consult?plan=basic"]').click();
  await expect(page).toHaveURL(/\/portfolio-kit\/consult\?plan=basic$/);
  await expect(page.getByRole("combobox")).toHaveValue("basic");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ポートフォリオ制作の相談");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("consultation.png"), fullPage: true });
});
test("retry reuses the receipt id and confirmed storage produces a receipt", async ({ page }) => {
  await mockPublic(page);
  const ids: string[] = [];
  await page.route(`${intakeOrigin}/api/inquiries`, async route => {
    const body = route.request().postDataJSON(); ids.push(body.id);
    await route.fulfill({ status: ids.length === 1 ? 503 : 201, json: ids.length === 1 ? { error: "保存を確認できません。再送してください。" } : { id: body.id, notification: { status: "pending" } } });
  });
  await page.goto("/portfolio-kit/consult?plan=editorial"); await fill(page);
  await page.getByRole("button", { name: "無料で相談を送る" }).click();
  await expect(page.getByRole("alert")).toContainText("再送");
  await page.getByRole("button", { name: "無料で相談を送る" }).click();
  await expect(page.getByRole("heading", { name: "相談を受け付けました" })).toBeVisible();
  await expect(page.getByText("内容の保存は完了していますが", { exact: false })).toBeVisible();
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
  await expect(page.getByRole("button", { name: "無料で相談を送る" })).toHaveCount(0);
});
test("browser notifies only after a durable claim and acknowledgement contains no customer data", async ({ page }) => {
  await mockPublic(page);
  const order: string[] = [];
  await page.route(`${intakeOrigin}/api/inquiries`, async route => { order.push("save"); await route.fulfill({ status: 201, json: { id: route.request().postDataJSON().id, notification: { status: "sending", token: "mock-proof", attemptedAt: "2026-09-06T00:00:00.000Z" } } }); });
  await page.route("https://formspree.io/**", async route => { order.push("notify"); expect(route.request().postDataJSON().email).toBe("qa@example.invalid"); await route.fulfill({ json: { ok: true } }); });
  await page.route(`${intakeOrigin}/api/inquiries/notification`, async route => { order.push("ack"); const body = route.request().postDataJSON(); expect(body.status).toBe("client_accepted"); expect(body.email).toBeUndefined(); expect(body.brief).toBeUndefined(); await route.fulfill({ json: { notification: "client_accepted" } }); });
  await page.goto("/portfolio-kit/consult"); await fill(page);
  await page.getByRole("button", { name: "無料で相談を送る" }).click();
  await expect(page.getByRole("heading", { name: "相談を受け付けました" })).toBeVisible();
  expect(order).toEqual(["save", "notify", "ack"]);
  await expect(page.getByText("通知の確認ができませんでした", { exact: false })).toHaveCount(0);
});
test("distributed customer sites cannot submit to the owner's intake", async ({ page }) => {
  await mockPublic(page, false); await page.goto("/portfolio-kit/consult");
  await expect(page.getByText("このサイトでは制作相談を受け付けていません。", { exact: false })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});

test("owner sales page shares the photo frame and shows usable delivery samples", async ({ page }, info) => {
  await mockPublic(page);
  await page.goto("/portfolio-kit");
  await expect(page.locator(".kit-sales")).toBeVisible();
  // 制作案内も作品と同じ器で包む。写真中心の器は 2026-09-30 に止めたので、止めている間は いつもの構成 の器。
  await expect(page.locator('.ps-site[data-site-design="book"]')).toHaveCount(BOOK_DESIGN_ENABLED ? 1 : 0);
  if (!BOOK_DESIGN_ENABLED) await expect(page.locator("header nav")).toBeVisible();
  await expect(page).toHaveTitle("写真を置く場所をつくる | 写真家のポートフォリオサイト");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("写真家のための");
  const tabs = page.getByRole("tablist", { name: "納品見本のページ" });
  await tabs.getByRole("tab", { name: "トップ", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "シリーズ", exact: true })).toBeFocused();
  await expect(page.locator("#sample-panel img")).toHaveAttribute("src", "/portfolio-kit/sample/series.webp");
  await expect.poll(() => page.locator("#sample-panel img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("link", { name: "実物のPDFを見る", exact: false })).toHaveAttribute("href", "/portfolio-kit/sample/portfolio.pdf");
  await expect(page.locator("#admin-video")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("sales.png"), fullPage: true });
  await page.getByRole("link", { name: "無料で制作を相談する", exact: false }).click();
  await expect(page).toHaveURL(/\/portfolio-kit\/consult\?plan=basic$/);
  await expect(page.getByRole("combobox")).toHaveValue("basic");
});

test("a guide link reaches the sales sample after lazy loading", async ({ page }) => {
  await mockPublic(page);
  await page.goto("/portfolio-kit/guide");
  await page.getByRole("link", { name: "完成見本を見る", exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio-kit#samples$/);
  await expect.poll(() => page.locator("#samples").evaluate(element => {
    const top = element.getBoundingClientRect().top;
    return top >= 0 && top < 120;
  })).toBe(true);
});
