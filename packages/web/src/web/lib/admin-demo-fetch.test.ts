import { afterEach, expect, test } from "bun:test";
import { ADMIN_DEMO_PHOTO_LIMIT, makeAdminDemoSettings, makeAdminDemoSnapshot } from "./admin-demo-data";
import { installAdminDemoFetch } from "./admin-demo-fetch";
import { addIntroductionExamples } from "./introduction-demo";

const realFetch = globalThis.fetch;
test("intro examples avoid photo memberships missing from the series index", () => {
  const snapshot = makeAdminDemoSnapshot("ids", { photos: [{ id: 1, seriesId: 504, seriesIds: [504, 601] }], series: [], categories: [], heroPhotos: [] });
  addIntroductionExamples(snapshot);
  expect(snapshot.series.map(s => s.id)).toEqual([602, 603]);
  expect(snapshot.photos[0]!.seriesIds).toEqual([504, 601, 602]);
});

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
  expect(settings.siteDesign).toBe("book");
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


test("current Studio demo persists membership, series edits, publish state and undo locally", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "https://akieguchi.com").pathname;
    calls.push(path);
    return Response.json(path === "/api/photos" ? { photos: [{ id: 1, isPublished: true, seriesIds: [4, 5] }] }
      : path === "/api/series" ? { series: [{ id: 4, slug: "one" }, { id: 5, slug: "two" }] } : {});
  }) as typeof fetch;
  const restore = installAdminDemoFetch("studio-test");
  const read = async (path: string) => (await fetch(path)).json();
  const write = async (path: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST") => fetch(path, { method, body: JSON.stringify(body) });
  try {
    expect((await read("/api/admin/series-photos")).memberships).toHaveLength(2);
    const created = await (await write("/api/admin/series", { title: "Local", slug: "local", kind: "series" })).json();
    const id = created.series.id;
    await write(`/api/admin/series/${id}/photos`, { add: [1] });
    expect((await read("/api/admin/series-photos")).memberships).toHaveLength(3);
    await write(`/api/admin/series/${id}`, { title: "Edited" }, "PATCH");
    expect((await read("/api/series/local")).series.title).toBe("Edited");
    expect((await read("/api/series/local")).photos).toHaveLength(1);
    await write("/api/admin/photos/batch", { ids: [1], operation: "unpublish" });
    expect((await read("/api/photos?all=1")).photos[0].isPublished).toBe(false);
    expect((await read("/api/series/local")).photos).toHaveLength(0);
    await write("/api/admin/photos/batch", { ids: [1], operation: "publish" });
    await write(`/api/admin/series/${id}/photos`, { remove: [1] });
    expect((await read("/api/series/local")).photos).toHaveLength(0);
    await write("/api/admin/photos/1", {}, "DELETE");
    expect((await read("/api/admin/photos/trash")).photos).toHaveLength(1);
    await write("/api/admin/photos/1/restore", {});
    expect((await read("/api/admin/photos/trash")).photos).toHaveLength(0);
    expect((await write("/api/admin/unsupported", {})).status).toBe(409);
    expect(calls.every(path => ["/api/photos", "/api/categories", "/api/series", "/api/hero-photos"].includes(path))).toBe(true);
  } finally { restore(); }
});

test("a separate preview tab reads only the snapshot for its demo seed", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
  let restore = installAdminDemoFetch("preview-sharing");
  try {
    await fetch("/api/admin/settings", { method: "POST", body: JSON.stringify({ siteName: "My preview" }) });
    restore();
    restore = installAdminDemoFetch("preview-sharing");
    expect((await (await fetch("/api/settings")).json()).siteName).toBe("My preview");
    restore();
    restore = installAdminDemoFetch("other-demo");
    expect((await (await fetch("/api/settings")).json()).siteName).toBe("Photographer Name");
  } finally {
    restore();
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("introduction demo saves locally, lists text-only work and hides inactive copy", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = new URL(String(input), "https://akieguchi.com").pathname;
    return Response.json(path === "/api/photos" ? { photos: [] } : {});
  }) as typeof fetch;
  const restore = installAdminDemoFetch("intro-contract-test");
  try {
    const work = await (await fetch("/api/series?kind=work")).json();
    expect(work.series).toHaveLength(2);
    expect(work.series.every((s: { content: unknown }) => s.content === null)).toBe(true);
    const row = (await (await fetch("/api/admin/series")).json()).series[1];
    const next = JSON.stringify({ ...JSON.parse(row.content), enabled: false });
    const write = (expectedContent: string) => fetch(`/api/admin/series/${row.id}`, { method: "PATCH", body: JSON.stringify({ content: next, expectedContent }) });
    expect((await write("stale")).status).toBe(409);
    expect((await write(row.content)).ok).toBe(true);
    expect((await (await fetch(`/api/series/${row.slug}`)).json()).series.content).toBeNull();
    expect((await (await fetch("/api/admin/series")).json()).series[1].content).toBe(next);
  } finally { restore(); }
});
