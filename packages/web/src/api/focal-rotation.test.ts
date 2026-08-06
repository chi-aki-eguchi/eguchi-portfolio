import { afterEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "./database/schema";
import {
  buildFocalRotationByDelta,
  buildFocalRotationToAngle,
} from "./focal-rotation";
import { rotateFocalPoint } from "../shared/image-url";

// 2026-08-06 オーナー決定「回転したら焦点も一緒に回す」。
// SQL 側と、画面が使う純粋関数側で、同じ変換になっていることまで見る。

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

type Row = {
  id: number;
  rotationDeg: number;
  focalX: number | null;
  focalY: number | null;
};

async function makeTestDb(rows: readonly Row[]) {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(`
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      rotation_deg INTEGER NOT NULL DEFAULT 0,
      focal_x INTEGER,
      focal_y INTEGER
    )
  `);
  for (const row of rows) {
    await client.execute({
      sql: "INSERT INTO photos (id, url, title, rotation_deg, focal_x, focal_y) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        row.id,
        `https://example.test/${row.id}.webp`,
        `photo ${row.id}`,
        row.rotationDeg,
        row.focalX,
        row.focalY,
      ],
    });
  }
  return drizzle(client, { schema });
}

async function readRows(db: Awaited<ReturnType<typeof makeTestDb>>) {
  return db
    .select({
      id: schema.photos.id,
      rotationDeg: schema.photos.rotationDeg,
      focalX: schema.photos.focalX,
      focalY: schema.photos.focalY,
    })
    .from(schema.photos)
    .orderBy(schema.photos.id);
}

/** 一括の左右回転と同じ UPDATE を流す。 */
async function rotateByDelta(rows: readonly Row[], delta: 90 | 180 | 270) {
  const db = await makeTestDb(rows);
  await db.update(schema.photos).set({
    rotationDeg: sql`(${schema.photos.rotationDeg} + ${delta}) % 360`,
    ...buildFocalRotationByDelta(schema.photos, delta),
  });
  return readRows(db);
}

/** 写真1枚の保存（角度を絶対値で指定）と同じ UPDATE を流す。 */
async function rotateToAngle(rows: readonly Row[], target: 0 | 90 | 180 | 270) {
  const db = await makeTestDb(rows);
  await db.update(schema.photos).set({
    rotationDeg: target,
    ...buildFocalRotationToAngle(schema.photos, target),
  });
  return readRows(db);
}

const topLeft: Row = { id: 1, rotationDeg: 0, focalX: 0, focalY: 0 };
const offCentre: Row = { id: 2, rotationDeg: 0, focalX: 80, focalY: 20 };
const unset: Row = { id: 3, rotationDeg: 0, focalX: null, focalY: null };

describe("buildFocalRotationByDelta", () => {
  test("clockwise 90° moves the top-left focus to the top-right", async () => {
    const [row] = await rotateByDelta([topLeft], 90);
    expect(row).toEqual({ id: 1, rotationDeg: 90, focalX: 100, focalY: 0 });
  });

  test("counter-clockwise 90° moves the top-left focus to the bottom-left", async () => {
    const [row] = await rotateByDelta([topLeft], 270);
    expect(row).toEqual({ id: 1, rotationDeg: 270, focalX: 0, focalY: 100 });
  });

  test("180° flips the focus to the opposite corner", async () => {
    const [row] = await rotateByDelta([offCentre], 180);
    expect(row).toEqual({ id: 2, rotationDeg: 180, focalX: 20, focalY: 80 });
  });

  test("an unset focus stays unset — centre rotates to centre", async () => {
    const [row] = await rotateByDelta([unset], 90);
    expect(row).toEqual({ id: 3, rotationDeg: 90, focalX: null, focalY: null });
  });

  test("four right turns return every photo to where it started", async () => {
    let rows: Row[] = [topLeft, offCentre, unset];
    for (let turn = 0; turn < 4; turn += 1) {
      rows = (await rotateByDelta(rows, 90)) as Row[];
    }
    expect(rows).toEqual([topLeft, offCentre, unset]);
  });

  test("rotates each photo from its own current focus in one UPDATE", async () => {
    expect(await rotateByDelta([topLeft, offCentre, unset], 90)).toEqual([
      { id: 1, rotationDeg: 90, focalX: 100, focalY: 0 },
      { id: 2, rotationDeg: 90, focalX: 80, focalY: 80 },
      { id: 3, rotationDeg: 90, focalX: null, focalY: null },
    ]);
  });
});

describe("buildFocalRotationToAngle", () => {
  test("turns the focus by the difference from the photo's current angle", async () => {
    // 90° の写真を 180° へ = 差分90°。0° の写真を 180° へ = 差分180°。
    expect(
      await rotateToAngle(
        [
          { id: 1, rotationDeg: 90, focalX: 80, focalY: 20 },
          { id: 2, rotationDeg: 0, focalX: 80, focalY: 20 },
        ],
        180,
      ),
    ).toEqual([
      { id: 1, rotationDeg: 180, focalX: 80, focalY: 80 },
      { id: 2, rotationDeg: 180, focalX: 20, focalY: 80 },
    ]);
  });

  test("saving the same angle leaves the focus alone", async () => {
    expect(
      await rotateToAngle([{ id: 1, rotationDeg: 90, focalX: 80, focalY: 20 }], 90),
    ).toEqual([{ id: 1, rotationDeg: 90, focalX: 80, focalY: 20 }]);
  });

  test("treats a half-set focus as centred on the missing axis", async () => {
    expect(
      await rotateToAngle([{ id: 1, rotationDeg: 0, focalX: 10, focalY: null }], 90),
    ).toEqual([{ id: 1, rotationDeg: 90, focalX: 50, focalY: 10 }]);
  });
});

describe("rotateFocalPoint matches the SQL used by the API", () => {
  test.each([
    [90 as const, 90 as const],
    [180 as const, 180 as const],
    [270 as const, 270 as const],
  ])("delta %p agrees with the database result", async (delta) => {
    const start = { id: 1, rotationDeg: 0, focalX: 80, focalY: 20 };
    const [row] = await rotateByDelta([start], delta);
    expect(rotateFocalPoint(start.focalX, start.focalY, delta)).toEqual({
      focalX: row.focalX as number,
      focalY: row.focalY as number,
    });
  });

  test("a negative delta is the same as turning the long way round", () => {
    expect(rotateFocalPoint(80, 20, -90)).toEqual(rotateFocalPoint(80, 20, 270));
  });

  test("an unset focus is treated as the centre", () => {
    expect(rotateFocalPoint(null, undefined, 90)).toEqual({
      focalX: 50,
      focalY: 50,
    });
  });
});

describe("a single photo's rotation and focus move together", () => {
  test("one UPDATE writes both, so neither can be left behind", async () => {
    const db = await makeTestDb([{ id: 1, rotationDeg: 0, focalX: 0, focalY: 0 }]);
    await db
      .update(schema.photos)
      .set({
        rotationDeg: 90,
        ...buildFocalRotationToAngle(schema.photos, 90),
      })
      .where(eq(schema.photos.id, 1));

    expect(await readRows(db)).toEqual([
      { id: 1, rotationDeg: 90, focalX: 100, focalY: 0 },
    ]);
  });
});
