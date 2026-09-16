import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { heroPhotos, photos, series } from "./database/schema";
import { startIsolatedApi, type IsolatedApi } from "./test-support/isolated-api";

// 公開サイトへ写真を返す4つの経路が、同じ公開用の形を返すことを、本物の
// API経路で確かめる。DBは一時SQLite（isolated-api.ts）。
//
// 以前は写真一覧と写真1枚だけが管理用の列を落とし、作品詳細とトップの
// 写真は保存キーやファイルハッシュ、元ファイルの情報まで返していた。

// 管理画面だけが使う列。公開側は読まない。
const ADMIN_ONLY = ["fileHash", "thumbKey", "mediumKey", "isPublished", "deletedAt", "shotAtSource"];
// 元ファイルの記録。一覧の列定義にも含めていない。
const SOURCE_RECORD = ["shotAtDigitized", "sourceWidth", "sourceHeight", "sourceFormat", "cameraMake", "cameraModel"];
// 描画・srcset・回転・焦点・撮影情報・写真ページの文章が使う列。
const RENDERED = [
  "id", "filename", "url", "thumbUrl", "mediumUrl", "width", "height",
  "rotationDeg", "focalX", "focalY", "title", "description", "meta",
  "camera", "lens", "focalLength", "fNumber", "exposureTime", "iso",
  "filmType", "shotAt", "category", "displaySize", "seriesId", "sortOrder",
  "createdAt",
];

let api: IsolatedApi;
const ids: Record<string, number> = {};

const photoValues = (stem: string, extra: Partial<typeof photos.$inferInsert> = {}) => ({
  filename: `${stem}.jpg`,
  url: `/api/images/photos/${stem}.jpg`,
  thumbKey: `thumbs/${stem}.webp`,
  mediumKey: `medium/${stem}.webp`,
  fileHash: `hash-${stem}`,
  width: 3200,
  height: 2133,
  title: stem,
  camera: "PENTAX 67",
  filmType: "フィルム",
  shotAt: "1998-07-01",
  shotAtSource: "manual",
  shotAtDigitized: "2026-03-02T09:30:00",
  sourceWidth: 8256,
  sourceHeight: 5504,
  sourceFormat: "tiff",
  cameraMake: "NIKON CORPORATION",
  cameraModel: "NIKON D850",
  ...extra,
});

async function getJson(path: string) {
  const res = await api.request(path);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  api = await startIsolatedApi();
  const [shown] = await api.db.insert(series).values({ slug: "harbour", title: "港", kind: "work" }).returning();
  const [hidden] = await api.db
    .insert(series)
    .values({ slug: "draft", title: "下書き", isPublished: false })
    .returning();
  const insert = async (name: string, extra: Partial<typeof photos.$inferInsert>) => {
    const [row] = await api.db.insert(photos).values(photoValues(name, extra)).returning();
    ids[name] = row.id;
  };
  await insert("first", { seriesId: shown.id, sortOrder: 0 });
  await insert("rotated", { seriesId: shown.id, sortOrder: 1, rotationDeg: 90, focalX: 20, focalY: 80 });
  await insert("unpublished", { seriesId: shown.id, sortOrder: 2, isPublished: false });
  await insert("trashed", { seriesId: shown.id, sortOrder: 3, deletedAt: new Date() });
  await insert("in-draft", { seriesId: hidden.id, sortOrder: 4 });
  for (const [sortOrder, name] of ["first", "rotated", "unpublished", "trashed"].entries()) {
    await api.db.insert(heroPhotos).values({ photoId: ids[name], sortOrder });
  }
}, 30_000);

afterAll(async () => {
  await api?.stop();
});

async function publicPhotoResponses() {
  const list = await getJson("/api/photos");
  const single = await getJson(`/api/photos/${ids.first}`);
  const detail = await getJson("/api/series/harbour");
  const hero = await getJson("/api/hero-photos");
  for (const r of [list, single, detail, hero]) expect(r.status).toBe(200);
  return {
    "/api/photos": list.body.photos as Record<string, unknown>[],
    "/api/photos/:id": [single.body.photo as Record<string, unknown>],
    "/api/series/:slug": detail.body.photos as Record<string, unknown>[],
    "/api/hero-photos": hero.body.heroPhotos as Record<string, unknown>[],
  };
}

describe("public photo responses", () => {
  test("every public route returns the same public shape", async () => {
    const responses = await publicPhotoResponses();
    const shapes = Object.entries(responses).map(([route, rows]) => {
      expect({ route, count: rows.length > 0 }).toEqual({ route, count: true });
      return [route, Object.keys(rows[0]).sort()] as const;
    });
    for (const [route, keys] of shapes) {
      expect({ route, keys }).toEqual({ route, keys: shapes[0][1] });
      for (const key of [...ADMIN_ONLY, ...SOURCE_RECORD]) {
        expect({ route, leaked: keys.includes(key) ? key : null }).toEqual({ route, leaked: null });
      }
      for (const key of RENDERED) {
        expect({ route, missing: keys.includes(key) ? null : key }).toEqual({ route, missing: null });
      }
    }
  });

  test("rendering values survive the trim", async () => {
    const { "/api/series/:slug": detail, "/api/hero-photos": hero } = await publicPhotoResponses();
    for (const rows of [detail, hero]) {
      const rotated = rows.find((row) => row.id === ids.rotated)!;
      expect(rotated).toMatchObject({
        url: "/api/images/photos/rotated.jpg",
        width: 3200,
        height: 2133,
        rotationDeg: 90,
        focalX: 20,
        focalY: 80,
        camera: "PENTAX 67",
        filmType: "フィルム",
        shotAt: "1998-07-01",
      });
      // 回転した写真の縮小版は、回転を指定した画像経路を指す。
      expect(String(rotated.thumbUrl)).toContain("thumbs/rotated.webp");
      expect(String(rotated.thumbUrl)).toContain("rot=90");
      expect(String(rotated.mediumUrl)).toContain("medium/rotated.webp");
    }
  });

  test("series detail and hero keep hiding unpublished and trashed photos", async () => {
    const { "/api/series/:slug": detail, "/api/hero-photos": hero } = await publicPhotoResponses();
    for (const rows of [detail, hero]) {
      expect(rows.map((row) => row.id)).toEqual([ids.first, ids.rotated]);
    }
    expect((await getJson("/api/series/draft")).status).toBe(404);
  });

  test("the series itself still says which shelf it belongs to", async () => {
    const { body } = await getJson("/api/series/harbour");
    expect(body.series).toMatchObject({ slug: "harbour", title: "港", kind: "work" });
  });

  test("the signed-in library still receives the management fields", async () => {
    const res = await api.adminRequest("/api/photos?all=1");
    expect(res.status).toBe(200);
    const { photos: rows } = (await res.json()) as { photos: Record<string, unknown>[] };
    const first = rows.find((row) => row.id === ids.first)!;
    expect(first).toMatchObject({
      fileHash: "hash-first",
      thumbKey: "thumbs/first.webp",
      mediumKey: "medium/first.webp",
      isPublished: true,
      shotAtSource: "manual",
    });
    expect(rows.some((row) => row.id === ids.unpublished)).toBe(true);
  });
});
