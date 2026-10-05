import { test, expect, type Page, type SmokeApi } from "./fixtures.ts";
import { loginAsAdmin } from "./helpers";

async function editor(page: Page, api: SmokeApi, reject = false) {
  await loginAsAdmin(page);
  const data = await (await api.get("/api/admin/series")).json() as { series: Array<Record<string, unknown>> };
  const item = data.series.find(s => s.id === 503)!;
  let writes = 0;
  await page.route("**/api/admin/series", route => route.request().method() === "GET" ? route.fulfill({ json: data }) : route.fallback());
  await page.route("**/api/admin/series/503", async route => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON(); writes++;
    if (reject) return route.fulfill({ status: 503, json: { error: "offline test" } });
    expect(body.expectedContent).toBe(item.content ?? null);
    item.content = body.content;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/series/empty-series", route => route.fulfill({ json: { series: { ...item, content: item.content && JSON.parse(String(item.content)).enabled ? item.content : null }, photos: [] } }));
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "管理画面の入口" }).getByRole("button", { name: "シリーズ", exact: true }).click();
  await page.locator(".st-side__item").filter({ hasText: "写真のない組" }).click();
  const root = page.getByRole("region", { name: "紹介ページの編集" });
  await root.getByRole("button", { name: "紹介ページ", exact: true }).click();
  return { root, item, writes: () => writes };
}

test("文章とリンクを並べて保存し、写真0枚の紹介を開ける", async ({ page, api }) => {
  const { root, item } = await editor(page, api);
  await root.getByRole("button", { name: "＋ 文章", exact: true }).click();
  await root.getByLabel("見出し", { exact: true }).fill("担当したこと");
  await root.getByRole("textbox", { name: "本文", exact: true }).fill("企画と執筆を担当しました。\n読み手に伝わる構成を考えました。");
  await root.getByRole("button", { name: "＋ 外部リンク", exact: true }).click();
  await root.getByLabel("リンクの名前", { exact: true }).fill("記事を読む");
  await root.getByLabel("URL", { exact: true }).fill("https://example.com/article");
  await root.getByRole("button", { name: "2番目を上へ", exact: true }).click();
  await root.getByRole("button", { name: "紹介ページを保存", exact: true }).click();
  await expect(root.locator("output")).toHaveText("保存しました");
  const content = JSON.parse(String(item.content));
  expect(content.blocks.map((b: { type: string }) => b.type)).toEqual(["link", "text"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.goto("/series/empty-series");
  await expect(page.getByRole("heading", { name: "担当したこと", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "記事を読む" })).toHaveAttribute("href", "https://example.com/article");
  await expect(page.getByText("このシリーズにはまだ写真がありません")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("失敗時と別シリーズへの移動で下書きを失わない", async ({ page, api }) => {
  const { root, writes } = await editor(page, api, true);
  await root.getByRole("button", { name: "＋ 文章", exact: true }).click();
  await root.getByRole("textbox", { name: "本文", exact: true }).fill("消えてはいけない下書き");
  await root.getByRole("button", { name: "紹介ページを保存", exact: true }).click();
  await expect(root.getByRole("alert")).toContainText("保存できませんでした");
  expect(writes()).toBe(1);
  await root.getByRole("button", { name: "＋ 外部リンク", exact: true }).click();
  await root.getByLabel("URL", { exact: true }).fill("https://");
  await page.locator(".st-side__item").filter({ hasText: "港の光" }).click();
  await page.locator(".st-side__item").filter({ hasText: "写真のない組" }).click();
  await expect(root.getByRole("textbox", { name: "本文", exact: true })).toHaveValue("消えてはいけない下書き");
  await expect(root.getByLabel("URL", { exact: true })).toHaveValue("https://");
});

test("写真表示へ戻しても紹介本文を残す", async ({ page, api }) => {
  const { root, item } = await editor(page, api);
  await root.getByRole("button", { name: "＋ 文章", exact: true }).click();
  await root.getByRole("textbox", { name: "本文", exact: true }).fill("切り替えても残す本文");
  await root.getByRole("button", { name: "紹介ページを保存", exact: true }).click();
  await expect(root.locator("output")).toHaveText("保存しました");
  await root.getByRole("button", { name: "写真を並べる", exact: true }).click();
  await root.getByRole("button", { name: "紹介ページを保存", exact: true }).click();
  await expect(root.locator("output")).toHaveText("保存しました");
  expect(JSON.parse(String(item.content))).toMatchObject({ enabled: false, blocks: [{ text: "切り替えても残す本文" }] });
  await root.getByRole("button", { name: "紹介ページ", exact: true }).click();
  await expect(root.getByRole("textbox", { name: "本文", exact: true })).toHaveValue("切り替えても残す本文");
});
