import { afterEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./database/schema";
import { buildPublicCoverPhotoFilter } from "./series-cover-visibility";

// 文字列でソースを検査する形（`"schema.photos.isPublished, true"` を含むか）から、
// 実DBへ問い合わせる形へ差し替えた（2026-08-06）。前者はリファクタで壊れ、
// コメントに同じ文字列を書いても通ってしまい、非公開写真の露出を防げなかった。

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

type PhotoRow = {
  id: number;
  isPublished: boolean;
  deletedAt: string | null;
};

async function makeTestDb(photos: readonly PhotoRow[]) {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      is_published INTEGER NOT NULL,
      deleted_at TEXT
    )
  `);
  for (const photo of photos) {
    await client.execute({
      sql: "INSERT INTO photos (id, url, title, is_published, deleted_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        photo.id,
        `https://example.test/${photo.id}.webp`,
        `photo ${photo.id}`,
        photo.isPublished ? 1 : 0,
        photo.deletedAt,
      ],
    });
  }
  return drizzle(client, { schema });
}

/** `/series` のカバー写真取得と同じ条件で引き、返ってきたidを返す。 */
async function visibleCoverIds(
  photos: readonly PhotoRow[],
  coverIds: readonly number[],
) {
  const db = await makeTestDb(photos);
  const rows = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(buildPublicCoverPhotoFilter(schema.photos, coverIds));
  return rows.map((row) => row.id).sort((a, b) => a - b);
}

const published: PhotoRow = { id: 1, isPublished: true, deletedAt: null };
const unpublished: PhotoRow = { id: 2, isPublished: false, deletedAt: null };
const trashed: PhotoRow = {
  id: 3,
  isPublished: true,
  deletedAt: "2026-08-01T00:00:00",
};

describe("public series cover visibility", () => {
  test("returns a published cover photo", async () => {
    expect(await visibleCoverIds([published], [1])).toEqual([1]);
  });

  test("does not expose an unpublished cover photo", async () => {
    expect(await visibleCoverIds([published, unpublished], [1, 2])).toEqual([1]);
  });

  test("does not expose a cover photo that was moved to the trash", async () => {
    expect(await visibleCoverIds([published, trashed], [1, 3])).toEqual([1]);
  });

  test("returns nothing when every requested cover is hidden", async () => {
    expect(await visibleCoverIds([unpublished, trashed], [2, 3])).toEqual([]);
  });

  test("ignores published photos that no series points at", async () => {
    const other: PhotoRow = { id: 9, isPublished: true, deletedAt: null };
    expect(await visibleCoverIds([published, other], [1])).toEqual([1]);
  });
});
