import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { photos } from "./database/schema";
import { startIsolatedApi, type IsolatedApi } from "./test-support/isolated-api";

let api: IsolatedApi;
beforeAll(async () => { api = await startIsolatedApi(); }, 30000);
afterAll(async () => { await api?.stop(); });

test("opening trash repeatedly preserves old photos and storage; explicit purge still respects shared originals", async () => {
  const common = { filename: "old.jpg", url: "/api/images/photos/old.jpg", thumbKey: "thumbs/old.webp", mediumKey: "medium/old.webp" };
  const [old] = await api.db.insert(photos).values({ ...common, deletedAt: new Date(Date.now() - 90 * 86400000) }).returning();
  const [shared] = await api.db.insert(photos).values(common).returning();
  const [recent] = await api.db.insert(photos).values({ filename: "recent.jpg", url: "/api/images/photos/recent.jpg", deletedAt: new Date() }).returning();
  const before = await api.db.select().from(photos);
  expect((await api.request("/api/admin/photos/trash")).status).toBe(401);
  for (let n = 0; n < 2; n++) {
    const response = await api.adminRequest("/api/admin/photos/trash");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.automaticDeletion).toBe(false);
    expect(body.photos.map((p: {id: number}) => p.id)).toEqual([old.id, recent.id]);
  }
  expect(await api.db.select().from(photos)).toEqual(before);
  expect(api.storageRequests.filter(r => r.method === "DELETE")).toHaveLength(0);
  expect((await api.adminRequest(`/api/admin/photos/${old.id}/restore`, { method: "POST" })).status).toBe(200);
  expect((await api.adminRequest(`/api/admin/photos/${old.id}/purge`, { method: "DELETE" })).status).toBe(400);
  await api.db.update(photos).set({ deletedAt: new Date() }).where(eq(photos.id, old.id));
  expect((await api.request(`/api/admin/photos/${old.id}/purge`, { method: "DELETE" })).status).toBe(401);
  expect((await api.adminRequest(`/api/admin/photos/${old.id}/purge`, { method: "DELETE" })).status).toBe(200);
  expect(api.storageRequests.filter(r => r.method === "DELETE")).toHaveLength(0);
  expect(await api.db.select().from(photos).where(eq(photos.id, shared.id))).toHaveLength(1);
  expect((await api.adminRequest(`/api/admin/photos/${recent.id}/purge`, { method: "DELETE" })).status).toBe(200);
  expect(api.storageRequests.filter(r => r.method === "DELETE").map(r => r.key)).toEqual(["photos/recent.jpg"]);
}, 30000);
