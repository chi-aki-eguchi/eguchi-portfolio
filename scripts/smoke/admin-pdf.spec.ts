import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const { PDFDocument } = createRequire(resolve("packages/web/package.json"))(
  "pdf-lib",
);
import { test, expect } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

test("PDF専用APIは未認証では画像・一覧を返さない", async ({ api }) => {
  for (const path of [
    "/api/admin/pdf/photos",
    "/api/admin/pdf/photos/7001/image?quality=print",
  ]) {
    const r = await api.get(path);
    expect(r.status()).toBe(401);
  }
});
test("本の編集・保存・読み戻し・PDF出力はWebデータを変えない", async ({
  page,
  api,
}, info) => {
  test.setTimeout(120000);
  await loginAsAdmin(page);
  const before = await (await api.get("/api/photos?all=1")).json();
  await page.goto("/admin/pdf");
  await expect(
    page.getByRole("heading", { name: "PDF作品集", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("本の名前")).toBeVisible();
  await page.getByLabel("本の名前").fill("2026 光と影の記録");
  await page.getByLabel("氏名", { exact: true }).fill("写真家 秋");
  await page.locator(".pdf-picker button").nth(0).click();
  await page.locator(".pdf-picker button").nth(1).click();
  await page.locator(".pdf-picker button").nth(2).click();
  await page
    .getByRole("button", { name: "1ページを編集", exact: true })
    .click();
  await page.getByLabel("表紙の写真").selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "2ページを編集", exact: true })
    .click();
  await page.getByRole("button", { name: "次の写真と2枚に" }).first().click();
  await page.getByRole("button", { name: "右へ90°回転" }).first().click();
  await page
    .getByLabel("作品説明", { exact: true })
    .first()
    .fill("日常の光を記録する。日本語と English、句読点を確認します。");
  await page
    .getByRole("button", { name: "1ページを編集", exact: true })
    .click();
  await page.getByLabel("最後のページに載せる").check();
  await page
    .getByLabel("PDF用プロフィール", { exact: true })
    .fill("光と影を写真で記録しています。");
  await page
    .getByLabel("PDF用連絡先", { exact: true })
    .fill("contact@example.invalid");
  await page
    .getByRole("button", { name: "ブラウザーに保存", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("portfolio-pdf.v1.books"),
  );
  await page.reload();
  await expect(page.getByLabel("本の名前")).toHaveValue("2026 光と影の記録");
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "作品集ファイルを書き出す" }).click();
  const file = await jsonDownload;
  const filePath = await file.path();
  expect(filePath).toBeTruthy();
  await page.locator('input[type="file"]').setInputFiles(filePath!);
  await expect(page.getByLabel("本の名前")).toHaveValue("2026 光と影の記録");
  expect(JSON.parse(saved!)[0].pages).toHaveLength(2);
  const sizes: number[] = [];
  for (const quality of ["送信用", "印刷用"]) {
    await page.getByRole("button", { name: `${quality}PDFを生成` }).click();
    await expect(
      page.getByRole("link", { name: "PDFを保存", exact: true }),
    ).toBeVisible({ timeout: 60000 });
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "PDFを保存", exact: true }).click();
    const pdf = await download;
    const dest = info.outputPath(`${quality}.pdf`);
    await pdf.saveAs(dest);
    const size = statSync(dest).size;
    sizes.push(size);
    await expect(
      page.getByText(new RegExp(`${size.toLocaleString()} bytes`)),
    ).toBeVisible();
    const doc = await PDFDocument.load(readFileSync(dest));
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPages()[0].getWidth()).toBeCloseTo(595.276, 2);
    if (info.project.name === "desktop")
      await pdf.saveAs(resolve(`output/pdf/browser-${quality}.pdf`));
  }
  expect(sizes[1]).toBeGreaterThanOrEqual(sizes[0]);
  const after = await (await api.get("/api/photos?all=1")).json();
  expect(after).toEqual(before);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) requests.push(r.url());
  });
  await page.getByLabel("本の名前").fill("変更後");
  await expect(
    page.getByRole("link", { name: "PDFを保存", exact: true }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "ブラウザーに保存", exact: true })
    .click();
});
test("画像欠落・通信失敗・長文は成功と表示しない", async ({ page }) => {
  test.setTimeout(90000);
  await loginAsAdmin(page);
  await page.goto("/admin/pdf");
  await page.locator(".pdf-picker button").first().click();
  await page.route("**/api/admin/pdf/photos/*/image?quality=screen", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.getByRole("button", { name: "送信用PDFを生成" }).click();
  await expect(page.getByRole("alert")).toContainText("画像を読み込めません");
  await expect(
    page.getByRole("link", { name: "PDFを保存", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/admin/pdf/photos/*/image?quality=screen");
  await page
    .getByLabel("作品説明", { exact: true })
    .fill("長文の説明です。".repeat(200));
  await page.getByRole("button", { name: "送信用PDFを生成" }).click();
  await expect(page.locator(".pdf-issues")).toContainText(
    "文字が枠を超えています",
    { timeout: 60000 },
  );
  await expect(
    page.getByRole("link", { name: "PDFを保存", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "ブラウザーに保存", exact: true })
    .click();
});

test("20枚の横A4出力でも操作の応答と実ページ数を保つ", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await loginAsAdmin(page);
  await page.goto("/admin/pdf");
  await expect(page.locator(".pdf-picker button").nth(19)).toBeVisible();
  for (let n = 0; n < 20; n++)
    await page.locator(".pdf-picker button").nth(n).click();
  await page
    .getByRole("button", { name: "1ページを編集", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "用紙", exact: true })
    .selectOption("landscape");
  await page.getByLabel("最後のページに載せる").check();
  await page.evaluate(() => {
    const state = { ticks: 0, maxDelay: 0, last: performance.now() };
    (window as any).__pdfTiming = state;
    (window as any).__pdfTimer = setInterval(() => {
      const now = performance.now();
      state.ticks++;
      state.maxDelay = Math.max(state.maxDelay, now - state.last);
      state.last = now;
    }, 25);
  });
  const start = Date.now();
  await page.getByRole("button", { name: "印刷用PDFを生成" }).click();
  await expect(
    page.getByRole("link", { name: "PDFを保存", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const timing = await page.evaluate(() => {
    clearInterval((window as any).__pdfTimer);
    return (window as any).__pdfTiming;
  });
  expect(timing.ticks).toBeGreaterThan(2);
  expect(timing.maxDelay).toBeLessThan(2000);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDFを保存", exact: true }).click();
  const file = await download,
    dest = info.outputPath("20-photos.pdf");
  await file.saveAs(dest);
  const pdf = await PDFDocument.load(readFileSync(dest));
  expect(pdf.getPageCount()).toBe(22);
  expect(pdf.getPages()[0].getWidth()).toBeCloseTo(841.89, 2);
  console.log(
    JSON.stringify({
      project: info.project.name,
      photos: 20,
      pages: 22,
      ms: Date.now() - start,
      bytes: statSync(dest).size,
      ticks: timing.ticks,
      maxMainThreadDelayMs: Math.round(timing.maxDelay),
    }),
  );
  await page
    .getByRole("button", { name: "ブラウザーに保存", exact: true })
    .click();
});

test("ページを見て並べ替え、取り消し、用途切替、複製を独立して保存する", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin/pdf");
  await page.getByLabel("本の名前").fill("提出する本");
  for (let n = 0; n < 3; n++)
    await page.locator(".pdf-picker button").nth(n).click();
  await expect(page.locator(".pdf-canvas .pdf-paper image")).toHaveCount(1);
  const originalLast = await page
    .locator(".pdf-canvas .pdf-paper image")
    .getAttribute("href");
  await page.getByRole("button", { name: "前へ", exact: true }).click();
  await expect(
    page.locator('.pdf-filmstrip [aria-current="page"]'),
  ).toHaveAccessibleName("3ページを編集");
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(
    page.locator('.pdf-filmstrip [aria-current="page"]'),
  ).toHaveAccessibleName("4ページを編集");
  await expect(page.locator(".pdf-canvas .pdf-paper image")).toHaveAttribute(
    "href",
    originalLast!,
  );
  await page
    .getByLabel("作品説明", { exact: true })
    .fill("提出するときだけ表示する文章");
  await expect(
    page.locator(".pdf-canvas svg text").filter({ hasText: "提出するとき" }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "仕上がり", exact: true })
    .selectOption("photobook");
  await expect(
    page.locator(".pdf-canvas svg text").filter({ hasText: "提出するとき" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "作品説明", exact: true }),
  ).toHaveValue("提出するときだけ表示する文章");
  await page.getByRole("button", { name: "この本を複製", exact: true }).click();
  await expect(page.getByLabel("本の名前")).toHaveValue("提出する本 のコピー");
  await page.getByLabel("本の名前").fill("展示で見せる本");
  await page
    .getByRole("button", { name: "ブラウザーに保存", exact: true })
    .click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("portfolio-pdf.v1.books")!),
  );
  expect(stored).toHaveLength(2);
  expect(stored[0].title).toBe("展示で見せる本");
  expect(stored[1].title).toBe("提出する本");
  expect(stored[0].items[0].id).not.toBe(stored[1].items[0].id);
  await page.reload();
  await expect(page.getByLabel("本の名前")).toHaveValue("展示で見せる本");
  await expect(
    page.getByRole("combobox", { name: "仕上がり", exact: true }),
  ).toHaveValue("photobook");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
