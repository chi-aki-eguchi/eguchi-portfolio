import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, getTableColumns, max } from "drizzle-orm";
import { photos } from "./database/schema";
import type { DuplicateFreshColumn } from "./photo-duplicate";
import { startIsolatedApi, type IsolatedApi } from "./test-support/isolated-api";

// 写真の複製を、本物のAPI経路（ログイン→POST /api/admin/photos/:id/duplicate）で
// 確かめる。DBは一時SQLite、ストレージは127.0.0.1の偽物（isolated-api.ts）。

type PhotoRow = typeof photos.$inferSelect;
type PhotoInsert = typeof photos.$inferInsert;

const FRESH_COLUMNS: DuplicateFreshColumn[] = ["id", "sortOrder", "deletedAt", "createdAt"];
const COPIED_COLUMNS = Object.keys(getTableColumns(photos)).filter(
  (key) => !FRESH_COLUMNS.includes(key as DuplicateFreshColumn),
) as (keyof PhotoRow)[];

const shared = (stem: string) => ({
  filename: `${stem}.jpg`,
  url: `/api/images/photos/${stem}.jpg`,
  thumbKey: `thumbs/${stem}.webp`,
  mediumKey: `medium/${stem}.webp`,
  fileHash: `hash-${stem}`,
  width: 3200,
  height: 2133,
});

const FIXTURES: Record<string, PhotoInsert> = {
  digital: {
    ...shared("digital"),
    title: "朝の港",
    description: "説明文",
    category: "snap",
    displaySize: "L",
    isPublished: false,
    seriesId: 7,
    rotationDeg: 90,
    focalX: 30,
    focalY: 70,
    camera: "X-T5",
    lens: "XF33mmF1.4",
    focalLength: "33mm",
    fNumber: "f/2",
    exposureTime: "1/250",
    iso: "200",
    filmType: "デジタル",
    shotAt: "2026-05-01T06:12:00",
    shotAtSource: "exif_original",
    shotAtDigitized: "2026-05-01T06:12:00",
    sourceWidth: 7728,
    sourceHeight: 5152,
    sourceFormat: "jpeg",
    cameraMake: "FUJIFILM",
    cameraModel: "X-T5",
    sortOrder: 0,
  },
  // フィルム複写: 撮影日は手入力、複写した日時は別の列。
  film: {
    ...shared("film"),
    title: "1998年の夏",
    filmType: "フィルム",
    camera: "Nikon F3",
    shotAt: "1998-07-01",
    shotAtSource: "manual",
    shotAtDigitized: "2026-03-02T09:30:00",
    sourceWidth: 8256,
    sourceHeight: 5504,
    sourceFormat: "tiff",
    cameraMake: "NIKON CORPORATION",
    cameraModel: "NIKON D850",
    sortOrder: 1,
  },
  undated: {
    ...shared("undated"),
    filmType: "フィルム",
    shotAt: null,
    shotAtSource: "none",
    shotAtDigitized: null,
    sourceWidth: 4000,
    sourceHeight: 6000,
    sourceFormat: "tiff",
    cameraMake: null,
    cameraModel: null,
    sortOrder: 2,
  },
  // 由来を記録する前に登録された行。shot_at_source はDB既定の legacy。
  legacy: {
    ...shared("legacy"),
    shotAt: "2019-11-03",
    sortOrder: 3,
  },
};

let api: IsolatedApi;
const ids: Record<string, number> = {};

async function readPhoto(id: number): Promise<PhotoRow | undefined> {
  const [row] = await api.db.select().from(photos).where(eq(photos.id, id));
  return row;
}

async function duplicate(id: number) {
  const res = await api.adminRequest(`/api/admin/photos/${id}/duplicate`, {
    method: "POST",
  });
  const body = (await res.json()) as { photo?: { id: number } };
  return { status: res.status, id: body.photo?.id };
}

beforeAll(async () => {
  api = await startIsolatedApi();
  for (const [name, values] of Object.entries(FIXTURES)) {
    const [row] = await api.db.insert(photos).values(values).returning();
    ids[name] = row.id;
  }
}, 30_000);

afterAll(async () => {
  await api?.stop();
});

describe("POST /api/admin/photos/:id/duplicate", () => {
  test("requires the admin session", async () => {
    const res = await api.request(`/api/admin/photos/${ids.digital}/duplicate`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  for (const name of Object.keys(FIXTURES)) {
    test(`${name}: keeps every photo column and leaves the original untouched`, async () => {
      const before = await readPhoto(ids[name]);
      expect(before).toBeDefined();
      const [{ value: maxSort }] = await api.db
        .select({ value: max(photos.sortOrder) })
        .from(photos);
      const startedAt = Math.floor(Date.now() / 1000) * 1000;
      const requestsBefore = api.storageRequests.length;

      const result = await duplicate(ids[name]);

      expect(result.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.id).not.toBe(ids[name]);
      const copy = await readPhoto(result.id!);
      expect(copy).toBeDefined();
      for (const key of COPIED_COLUMNS) {
        expect({ key, value: copy![key] }).toEqual({ key, value: before![key] });
      }
      expect(copy!.sortOrder).toBe((maxSort ?? -1) + 1);
      expect(copy!.deletedAt).toBeNull();
      expect(copy!.createdAt.getTime()).toBeGreaterThanOrEqual(startedAt);
      // 元の行は1文字も変わらない。画像は共有するので、保存先には触れない。
      expect(await readPhoto(ids[name])).toEqual(before);
      expect(api.storageRequests.length).toBe(requestsBefore);
    });
  }

  test("film scans keep the shot date and the digitised time apart", async () => {
    const copy = await readPhoto((await duplicate(ids.film)).id!);
    expect(copy).toMatchObject({
      shotAt: "1998-07-01",
      shotAtSource: "manual",
      shotAtDigitized: "2026-03-02T09:30:00",
    });
  });

  test("undated photos stay undated instead of borrowing another date", async () => {
    const copy = await readPhoto((await duplicate(ids.undated)).id!);
    expect(copy).toMatchObject({
      shotAt: null,
      shotAtSource: "none",
      shotAtDigitized: null,
    });
  });

  test("legacy rows keep the legacy origin", async () => {
    const copy = await readPhoto((await duplicate(ids.legacy)).id!);
    expect(copy?.shotAtSource).toBe("legacy");
    expect(copy?.shotAt).toBe("2019-11-03");
  });

  test("a trashed or missing photo is not duplicated", async () => {
    const [trashed] = await api.db
      .insert(photos)
      .values({ ...shared("trashed"), deletedAt: new Date() })
      .returning();
    expect((await duplicate(trashed.id)).status).toBe(404);
    expect((await duplicate(999_999)).status).toBe(404);
  });
});

describe("shared images survive deleting one of the copies", () => {
  const keys = ["photos/digital.jpg", "thumbs/digital.webp", "medium/digital.webp"];
  const deletes = () =>
    api.storageRequests.filter((r) => r.method === "DELETE").map((r) => r.key);

  test("purging the original keeps the objects the copy still shows", async () => {
    const copyId = (await duplicate(ids.digital)).id!;
    // 上のテストで作った複製も同じ画像を参照している。ここで作った複製だけを残す。
    const others = (await api.db.select().from(photos).where(eq(photos.url, "/api/images/photos/digital.jpg")))
      .filter((row) => row.id !== copyId);

    for (const row of others) {
      const trash = await api.adminRequest(`/api/admin/photos/${row.id}`, { method: "DELETE" });
      expect(trash.status).toBe(200);
      const purge = await api.adminRequest(`/api/admin/photos/${row.id}/purge`, { method: "DELETE" });
      expect(purge.status).toBe(200);
    }

    expect(deletes()).toEqual([]);
    const copy = await readPhoto(copyId);
    expect(copy?.url).toBe("/api/images/photos/digital.jpg");
    expect(copy?.deletedAt).toBeNull();

    // 最後の1枚を消したときだけ、実体を消す。
    await api.adminRequest(`/api/admin/photos/${copyId}`, { method: "DELETE" });
    const purge = await api.adminRequest(`/api/admin/photos/${copyId}/purge`, { method: "DELETE" });
    expect(purge.status).toBe(200);
    expect(deletes().sort()).toEqual([...keys].sort());
  });
});
