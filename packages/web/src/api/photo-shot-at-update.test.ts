import { afterEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as sqliteSchema from "./database/schema";
import * as postgresSchema from "./database/schema.postgres";
import { buildShotAtPatchUpdate } from "./photo-shot-at-update";

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function makeTestDb(
  shotAt: string | null,
  shotAtSource: string,
) {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      shot_at TEXT,
      shot_at_source TEXT NOT NULL
    )
  `);
  await client.execute({
    sql: "INSERT INTO photos (id, title, shot_at, shot_at_source) VALUES (?, ?, ?, ?)",
    args: [1, "before", shotAt, shotAtSource],
  });
  return drizzleLibsql(client, { schema: sqliteSchema });
}

async function patchAndRead(
  currentShotAt: string | null,
  currentSource: string,
  incomingShotAt: unknown,
  title = "before",
) {
  const db = await makeTestDb(currentShotAt, currentSource);
  await db
    .update(sqliteSchema.photos)
    .set({
      title,
      ...buildShotAtPatchUpdate(incomingShotAt, {
        shotAt: sqliteSchema.photos.shotAt,
        shotAtSource: sqliteSchema.photos.shotAtSource,
      }),
    })
    .where(eq(sqliteSchema.photos.id, 1));

  const [photo] = await db
    .select({
      title: sqliteSchema.photos.title,
      shotAt: sqliteSchema.photos.shotAt,
      shotAtSource: sqliteSchema.photos.shotAtSource,
    })
    .from(sqliteSchema.photos)
    .where(eq(sqliteSchema.photos.id, 1));
  return photo;
}

describe("buildShotAtPatchUpdate", () => {
  test("keeps shotAtSource when the same date is sent", async () => {
    const shotAt = "2026-07-28T12:34:56";
    expect(
      await patchAndRead(shotAt, "exif_original", shotAt),
    ).toEqual({
      title: "before",
      shotAt,
      shotAtSource: "exif_original",
    });
  });

  test("marks a different date as manual", async () => {
    expect(
      await patchAndRead(
        "2026-07-28T12:34:56",
        "exif_original",
        "2026-07-29",
      ),
    ).toEqual({
      title: "before",
      shotAt: "2026-07-29",
      shotAtSource: "manual",
    });
  });

  test("marks a cleared non-null date as none", async () => {
    expect(
      await patchAndRead("2026-07-28T12:34:56", "exif_original", ""),
    ).toEqual({
      title: "before",
      shotAt: null,
      shotAtSource: "none",
    });
  });

  test("preserves shotAtSource when an already-null date is cleared", async () => {
    expect(await patchAndRead(null, "none", null)).toEqual({
      title: "before",
      shotAt: null,
      shotAtSource: "none",
    });
  });

  test("a title-only edit that resends the same date preserves its source", async () => {
    const shotAt = "2026-07-28T12:34:56";
    expect(
      await patchAndRead(shotAt, "exif_original", shotAt, "changed title"),
    ).toEqual({
      title: "changed title",
      shotAt,
      shotAtSource: "exif_original",
    });
  });

  test("compiles the same standard CASE expressions for Postgres", () => {
    const db = drizzlePostgres.mock({ schema: postgresSchema });
    const changedDateQuery = db
      .update(postgresSchema.photos)
      .set(
        buildShotAtPatchUpdate("2026-07-29", {
          shotAt: postgresSchema.photos.shotAt,
          shotAtSource: postgresSchema.photos.shotAtSource,
        }),
      )
      .where(eq(postgresSchema.photos.id, 1))
      .toSQL();
    const clearDateQuery = db
      .update(postgresSchema.photos)
      .set(
        buildShotAtPatchUpdate(null, {
          shotAt: postgresSchema.photos.shotAt,
          shotAtSource: postgresSchema.photos.shotAtSource,
        }),
      )
      .where(eq(postgresSchema.photos.id, 1))
      .toSQL();

    expect(changedDateQuery.sql).toMatch(
      /case when (?:"photos"\.)?"shot_at" = \$\d+ then (?:"photos"\.)?"shot_at_source" else 'manual' end/i,
    );
    expect(clearDateQuery.sql).toMatch(
      /case when (?:"photos"\.)?"shot_at" is null then (?:"photos"\.)?"shot_at_source" else 'none' end/i,
    );
  });
});
