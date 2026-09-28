import { test, expect } from "./fixtures.ts";

test("Current demo video decodes, plays and has Japanese captions", async ({ page, api }) => {
  const settings = await (await api.get("/api/settings")).json();
  await page.route("**/api/settings**", route => route.fulfill({ json: { ...settings, siteUrl: "https://akieguchi.com", servicePageMode: "on" } }));
  await page.goto("/portfolio-kit#admin-video", { waitUntil: "networkidle" });
  const video = page.getByLabel("Portfolio Kit 管理画面の操作実演");
  await expect(video).toBeVisible();
  // Exercise the actual static media decoder, not a mocked response.
  await video.evaluate(async (el: HTMLVideoElement) => { el.muted = true; await el.play(); });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0);
  const media = await video.evaluate((el: HTMLVideoElement) => ({ width: el.videoWidth, height: el.videoHeight, duration: el.duration, error: el.error?.code ?? null }));
  expect(media.width).toBe(1440);
  expect(media.height).toBe(1000);
  expect(media.duration).toBeGreaterThan(34);
  expect(media.duration).toBeLessThan(36);
  expect(media.error).toBeNull();
  // Safari may follow the user's caption preference instead of HTML default.
  // Selecting the supplied track must load and render all of its cues.
  await video.evaluate((el: HTMLVideoElement) => { el.textTracks[0].mode = "showing"; });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.textTracks[0]?.cues?.length ?? 0)).toBe(7);
  await video.evaluate((el: HTMLVideoElement) => { el.currentTime = 31; });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.textTracks[0]?.activeCues?.[0]?.text ?? "")).toContain("保存を確認");
  await video.evaluate((el: HTMLVideoElement) => el.pause());
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
