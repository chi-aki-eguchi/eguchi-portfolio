import { afterAll, beforeAll, expect, test } from "bun:test";
import { photos } from "./database/schema";
import { startIsolatedApi, type IsolatedApi } from "./test-support/isolated-api";

// 公開の写真一覧（/api/photos）は、誰が見ても同じなのでサーバーが控える（api/index.ts の
// publicPhotoList）。控えてよいのは「管理画面で変えたら、すぐ作り直す」限り。本物の API 経路と
// 一時 SQLite（isolated-api.ts）で、その約束を確かめる。

let api: IsolatedApi;

const values = (stem: string, sortOrder: number) => ({
  filename: `${stem}.jpg`,
  url: `/api/images/photos/${stem}.jpg`,
  width: 3200,
  height: 2133,
  title: stem,
  sortOrder,
});

const titles = async (path = "/api/photos") =>
  ((await (await api.request(path)).json()) as { photos: { title: string }[] }).photos.map((p) => p.title);

beforeAll(async () => {
  api = await startIsolatedApi();
  await api.db.insert(photos).values([values("a", 0), values("b", 1)]);
}, 30_000);

afterAll(async () => {
  await api?.stop();
});

test("公開の一覧は控えを返し、管理画面で変えたら次の要求で作り直す", async () => {
  expect(await titles()).toEqual(["a", "b"]);
  // 管理画面を通さずに DB を直接変えても、控えのあいだは前の一覧のまま（版が進まない）。
  const [c] = await api.db.insert(photos).values(values("c", 2)).returning();
  expect(await titles()).toEqual(["a", "b"]);
  // 件数・ランダムの指定がある一覧（トップ用）は控えない。
  expect(await titles("/api/photos?limit=10")).toEqual(["a", "b", "c"]);
  // 管理画面の書き込みが成功すると公開内容の版が進み、次の要求で作り直す。
  const res = await api.adminRequest(`/api/admin/photos/${c.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "c2" }),
  });
  expect(res.status).toBe(200);
  expect(await titles()).toEqual(["a", "b", "c2"]);
});

test("管理画面の一覧（?all=1）は控えを使わず、非公開も今までどおり返す", async () => {
  const [hidden] = await api.db.insert(photos).values({ ...values("hidden", 3), isPublished: false }).returning();
  const res = await api.adminRequest("/api/photos?all=1");
  const list = ((await res.json()) as { photos: { id: number }[] }).photos.map((p) => p.id);
  expect(list).toContain(hidden.id);
  expect(await titles()).not.toContain("hidden");
});
