import { afterEach, expect, test } from "bun:test";
import { ADMIN_DEMO_PHOTO_LIMIT, makeAdminDemoSettings, makeAdminDemoSnapshot } from "./admin-demo-data";
import { installAdminDemoFetch } from "./admin-demo-fetch";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("demo fetch keeps every write off the network and updates memory only", async () => {
  const networkMethods: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    networkMethods.push((init?.method ?? "GET").toUpperCase());
    const path = new URL(String(input), "https://akieguchi.com").pathname;
    const payload = path === "/api/photos" ? { photos: [] }
      : path === "/api/categories" ? { categories: [] }
        : path === "/api/series" ? { series: [] }
          : path === "/api/hero-photos" ? { heroPhotos: [] }
            : {};
    return new Response(JSON.stringify(payload));
  }) as typeof fetch;
  const restore = installAdminDemoFetch();
  try {
    await fetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ siteName: "Demo" }),
    });
    await fetch("/api/admin/photos/1", {
      method: "DELETE",
    });
    const settings = await (await fetch("/api/settings")).json() as { siteName: string };
    expect(settings.siteName).toBe("Demo");
    expect(networkMethods.filter((method) => method !== "GET")).toHaveLength(0);
  } finally {
    restore();
  }
});

test("demo settings are neutral and never copy owner-specific public settings", () => {
  const settings = makeAdminDemoSettings();
  expect(settings.siteName).toBe("Photographer Name");
  expect(settings.siteNameEn).toBe("Photographer Name");
  expect(settings.contactEmail).toBe("");
  expect(settings.formspreeUrl).toBe("");
  expect(settings.googleSiteVerification).toBe("");
  expect(settings.siteUrl).toBe("");
  expect(JSON.stringify(settings)).not.toContain("akieguchi");
});

test("demo snapshot limits photos and keeps related data consistent", () => {
  const photos = Array.from({ length: 35 }, (_, index) => ({
    id: index + 1,
    category: index < 30 ? "kept" : "unused",
    seriesId: index < 30 ? 7 : 9,
  }));
  const snapshot = makeAdminDemoSnapshot("fixed-seed", {
    photos,
    categories: [{ id: 1, slug: "kept" }, { id: 2, slug: "missing" }],
    series: [{ id: 7, coverPhotoId: 35 }, { id: 99, coverPhotoId: null }],
    heroPhotos: [{ id: 35 }],
  });
  expect(snapshot.photos.length).toBe(ADMIN_DEMO_PHOTO_LIMIT);
  expect(snapshot.photos.length).toBeLessThanOrEqual(20);
  expect(snapshot.categories.every((category) => snapshot.photos.some((photo) => photo.category === category.slug))).toBe(true);
  expect(snapshot.series.every((series) => snapshot.photos.some((photo) => photo.seriesId === series.id))).toBe(true);
  expect(snapshot.heroPhotos.every((photo) => snapshot.photos.some((sample) => sample.id === photo.id))).toBe(true);
});
