import { afterEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./database/schema";
import {
  applyBatchPhotoMetadata,
  buildBatchPhotoMetadataPatch,
} from "./batch-photo-metadata";

describe("buildBatchPhotoMetadataPatch", () => {
  test("combines supplied metadata fields into one patch", () => {
    expect(
      buildBatchPhotoMetadataPatch({
        camera: "Nikon F3",
        lens: "",
        filmType: "フィルム",
      }),
    ).toEqual({ camera: "Nikon F3", filmType: "フィルム" });
  });

  test("keeps the existing whitespace-clears-field behavior", () => {
    expect(buildBatchPhotoMetadataPatch({ lens: "  " })).toEqual({
      lens: null,
    });
  });

  test("rejects malformed payloads instead of silently dropping a field", () => {
    expect(buildBatchPhotoMetadataPatch(null)).toBeNull();
    expect(buildBatchPhotoMetadataPatch([])).toBeNull();
    expect(buildBatchPhotoMetadataPatch({ camera: 123 })).toBeNull();
    expect(buildBatchPhotoMetadataPatch({ camera: "" })).toBeNull();
  });

  // 型違いが1つでもあれば payload 全体を拒否する。有効な値と混ざったときに
  // その1件だけ黙って捨てて保存すると、利用者は失敗に気づけない。
  // 2026-08-06 の追試で、この分岐だけテストが無いと分かった。
  test("rejects the whole payload when one field is malformed", () => {
    expect(
      buildBatchPhotoMetadataPatch({ camera: "Nikon F3", lens: 50 }),
    ).toBeNull();
  });
});

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function makeTestDb() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      camera TEXT,
      lens TEXT,
      film_type TEXT
    )
  `);
  for (const id of [1, 2, 3]) {
    await client.execute({
      sql: "INSERT INTO photos (id, url, title, camera, lens, film_type) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, `https://example.test/${id}.webp`, `photo ${id}`, "旧カメラ", "旧レンズ", "デジタル"],
    });
  }
  return drizzle(client, { schema });
}

async function readAll(db: Awaited<ReturnType<typeof makeTestDb>>) {
  return db
    .select({
      id: schema.photos.id,
      camera: schema.photos.camera,
      lens: schema.photos.lens,
      filmType: schema.photos.filmType,
    })
    .from(schema.photos)
    .orderBy(schema.photos.id);
}

// index.ts に書き込みが残っていた頃は、この経路をソース文字列でしか検査できず、
// `.set(patch)` を `.set({})` にしても全テストが通った(2026-08-06 追試 M3)。
describe("applyBatchPhotoMetadata", () => {
  test("writes every supplied field to exactly the selected photos", async () => {
    const db = await makeTestDb();
    await applyBatchPhotoMetadata(db, schema.photos, [1, 3], {
      camera: "Nikon F3",
      lens: "50mm",
      filmType: "フィルム",
    });

    expect(await readAll(db)).toEqual([
      { id: 1, camera: "Nikon F3", lens: "50mm", filmType: "フィルム" },
      { id: 2, camera: "旧カメラ", lens: "旧レンズ", filmType: "デジタル" },
      { id: 3, camera: "Nikon F3", lens: "50mm", filmType: "フィルム" },
    ]);
  });

  test("leaves fields the dialog did not send untouched", async () => {
    const db = await makeTestDb();
    await applyBatchPhotoMetadata(db, schema.photos, [2], {
      camera: "Leica M6",
    });

    expect(await readAll(db)).toEqual([
      { id: 1, camera: "旧カメラ", lens: "旧レンズ", filmType: "デジタル" },
      { id: 2, camera: "Leica M6", lens: "旧レンズ", filmType: "デジタル" },
      { id: 3, camera: "旧カメラ", lens: "旧レンズ", filmType: "デジタル" },
    ]);
  });

  test("clears a field when the patch carries null", async () => {
    const db = await makeTestDb();
    await applyBatchPhotoMetadata(db, schema.photos, [1], { lens: null });

    const [first] = await readAll(db);
    expect(first).toEqual({
      id: 1,
      camera: "旧カメラ",
      lens: null,
      filmType: "デジタル",
    });
  });

  test("touches nothing when no photo is selected", async () => {
    const db = await makeTestDb();
    await applyBatchPhotoMetadata(db, schema.photos, [], { camera: "X" });

    expect((await readAll(db)).every((row) => row.camera === "旧カメラ")).toBe(
      true,
    );
  });
});
