import { afterEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "./database/schema";
import { seriesMembership } from "./series-membership";
import {
  REPAIR_SERIES_MEMBERSHIP_SQL,
  SERIES_PHOTOS_TABLE_SQL,
  ensureSeriesPhotos,
} from "./database/migrate";

// シリーズと写真の結びつき（多対多、2026-09-26）。実DB（メモリ上の SQLite）で
// 確かめる。代表のシリーズ（photos.series_id）が結びつきと食い違わないことが要。

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

const m = seriesMembership(schema);

async function makeDb({ withTable = true } = {}) {
  const client = createClient({ url: ":memory:" });
  clients.push(client);
  await client.execute(
    "CREATE TABLE series (id INTEGER PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', statement TEXT NOT NULL DEFAULT '', cover_photo_id INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, theme_config TEXT, kind TEXT NOT NULL DEFAULT 'series')",
  );
  await client.execute(
    "CREATE TABLE photos (id INTEGER PRIMARY KEY, series_id INTEGER, sort_order INTEGER NOT NULL DEFAULT 0)",
  );
  if (withTable) for (const stmt of SERIES_PHOTOS_TABLE_SQL) await client.execute(stmt);
  // シリーズ A(並び0) B(並び1) C(並び2)
  await client.execute("INSERT INTO series (id, slug, title, sort_order) VALUES (1,'a','A',0),(2,'b','B',1),(3,'c','C',2)");
  await client.execute("INSERT INTO photos (id, series_id, sort_order) VALUES (10,NULL,0),(11,NULL,1),(12,NULL,2),(13,NULL,3)");
  return { client, db: drizzle(client, { schema }) };
}

async function primaryOf(client: Client) {
  const r = await client.execute("SELECT id, series_id FROM photos ORDER BY id");
  return Object.fromEntries(r.rows.map((row) => [Number(row.id), row.series_id == null ? null : Number(row.series_id)]));
}

async function membersOf(client: Client, seriesId: number) {
  const r = await client.execute({
    sql: "SELECT photo_id FROM series_photos WHERE series_id = ? ORDER BY sort_order",
    args: [seriesId],
  });
  return r.rows.map((row) => Number(row.photo_id));
}

describe("シリーズへ足す・外す", () => {
  test("1枚を2本のシリーズに入れられ、代表はシリーズの並びが前のほう", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 2, [10, 11]);
    await m.addPhotosToSeries(db, 1, [10]);
    expect(await membersOf(client, 2)).toEqual([10, 11]);
    expect(await membersOf(client, 1)).toEqual([10]);
    expect(await primaryOf(client)).toMatchObject({ 10: 1, 11: 2, 12: null });
    const byPhoto = await m.membershipsByPhoto(db);
    expect(byPhoto.get(10)).toEqual([1, 2]);
  });

  test("足すと最後に並び、既に入っている写真は位置を変えない", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [12, 10]);
    await m.addPhotosToSeries(db, 1, [10, 13]);
    expect(await membersOf(client, 1)).toEqual([12, 10, 13]);
  });

  test("外すとそのシリーズからだけ消え、代表は残りの所属へ移る", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10]);
    await m.addPhotosToSeries(db, 3, [10]);
    await m.removePhotosFromSeries(db, 1, [10]);
    expect(await membersOf(client, 3)).toEqual([10]);
    expect((await primaryOf(client))[10]).toBe(3);
    await m.removePhotosFromSeries(db, 3, [10]);
    expect((await primaryOf(client))[10]).toBeNull();
  });
});

describe("いつもの構成の画面（1枚1シリーズ）", () => {
  test("seriesId を送ると、その1本に置き換わる。null で全部外れる", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10]);
    await m.addPhotosToSeries(db, 2, [10]);
    await m.replaceMemberships(db, [10], 3);
    expect(await membersOf(client, 1)).toEqual([]);
    expect(await membersOf(client, 2)).toEqual([]);
    expect(await membersOf(client, 3)).toEqual([10]);
    expect((await primaryOf(client))[10]).toBe(3);
    await m.replaceMemberships(db, [10], null);
    expect(await membersOf(client, 3)).toEqual([]);
    expect((await primaryOf(client))[10]).toBeNull();
  });

  test("既に入っているシリーズへ置き換えても、そのシリーズの中の位置は保つ", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [11, 10, 12]);
    await m.replaceMemberships(db, [10], 1);
    expect(await membersOf(client, 1)).toEqual([11, 10, 12]);
  });
});

describe("並べ替え・シリーズの削除・複製", () => {
  test("シリーズの写真全部を送れば並びが変わり、食い違えば断る", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10, 11, 12]);
    expect(await m.reorderSeriesPhotos(db, 1, [12, 10, 11])).toEqual({ ok: true });
    expect(await membersOf(client, 1)).toEqual([12, 10, 11]);
    expect((await m.reorderSeriesPhotos(db, 1, [12, 10])).ok).toBe(false);
    expect((await m.reorderSeriesPhotos(db, 1, [12, 10, 13])).ok).toBe(false);
    expect(await membersOf(client, 1)).toEqual([12, 10, 11]);
  });

  test("シリーズを消すと結びつきが消え、代表はほかの所属へ", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10, 11]);
    await m.addPhotosToSeries(db, 2, [10]);
    await client.execute("DELETE FROM series WHERE id = 1");
    await m.deleteSeriesMemberships(db, 1);
    expect(await membersOf(client, 1)).toEqual([]);
    expect(await primaryOf(client)).toMatchObject({ 10: 2, 11: null });
  });

  test("複製した写真は同じシリーズ全部へ入る", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10]);
    await m.addPhotosToSeries(db, 3, [10]);
    await m.copyMemberships(db, 10, 13);
    expect(await membersOf(client, 1)).toEqual([10, 13]);
    expect(await membersOf(client, 3)).toEqual([10, 13]);
    expect((await primaryOf(client))[13]).toBe(1);
  });
});

describe("起動時の用意（本番の Turso）", () => {
  test("表が無ければ作り、今までの所属（series_id）を写す。2回目は何も増やさない", async () => {
    const { client, db } = await makeDb({ withTable: false });
    await client.execute("UPDATE photos SET series_id = 2 WHERE id IN (10, 11)");
    const runner = { run: (q: ReturnType<typeof sql>) => db.run(q) };
    await ensureSeriesPhotos(runner, { createTable: true });
    expect(await membersOf(client, 2)).toEqual([10, 11]);
    await ensureSeriesPhotos(runner, { createTable: true });
    expect(await membersOf(client, 2)).toEqual([10, 11]);
  });

  test("修復は、結びつきの無い写真にだけ代表のシリーズを足す", async () => {
    const { client, db } = await makeDb();
    await m.addPhotosToSeries(db, 1, [10]);
    await m.addPhotosToSeries(db, 3, [10]);
    // 古い経路が series_id だけを書いた写真
    await client.execute("UPDATE photos SET series_id = 2 WHERE id = 12");
    await client.execute(REPAIR_SERIES_MEMBERSHIP_SQL);
    expect(await membersOf(client, 2)).toEqual([12]);
    expect(await membersOf(client, 1)).toEqual([10]);
    expect(await membersOf(client, 3)).toEqual([10]);
  });
});
