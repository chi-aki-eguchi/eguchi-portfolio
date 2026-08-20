import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql, type SQL } from "drizzle-orm";
import {
  ensureColumnsExist,
  TURSO_SAFETY_NET_COLUMNS,
  type ColumnRunner,
} from "./migrate";

// 本番DBには一切つながない。すべて :memory: の使い捨てSQLite。
function freshDb() {
  return drizzle(createClient({ url: ":memory:" }));
}

/** `0003` より前の photos。セーフティネットが面倒を見る16列は1つも無い。 */
async function createLegacyPhotos(db: ReturnType<typeof freshDb>) {
  await db.run(sql`
    CREATE TABLE photos (
      id integer PRIMARY KEY AUTOINCREMENT,
      filename text NOT NULL,
      url text NOT NULL,
      title text NOT NULL DEFAULT '',
      camera text,
      lens text,
      sort_order integer NOT NULL DEFAULT 0
    )
  `);
}

async function columnNames(db: ReturnType<typeof freshDb>): Promise<string[]> {
  const rows = (await db.all(sql`PRAGMA table_info(photos)`)) as {
    name: string;
  }[];
  return rows.map((r) => r.name);
}

describe("TURSO_SAFETY_NET_COLUMNS", () => {
  test("16列ある（9列だった時期に0005の7列が漏れていた）", () => {
    expect(TURSO_SAFETY_NET_COLUMNS).toHaveLength(16);
  });

  test("先頭9列の並びと型は従来のまま（既存の列の扱いを変えない）", () => {
    expect(TURSO_SAFETY_NET_COLUMNS.slice(0, 9)).toEqual([
      ["photos", "focal_length", "text"],
      ["photos", "f_number", "text"],
      ["photos", "exposure_time", "text"],
      ["photos", "iso", "text"],
      ["photos", "thumb_key", "text"],
      ["photos", "medium_key", "text"],
      ["photos", "rotation_deg", "integer NOT NULL DEFAULT 0"],
      ["photos", "focal_x", "integer NOT NULL DEFAULT 50"],
      ["photos", "focal_y", "integer NOT NULL DEFAULT 50"],
    ]);
  });

  // ここが本命の再発防止。次に migration で列を足した人が、この表を更新し忘れると
  // 落ちる。「schema と安全網がずれる」という今回の不具合そのものを見張る。
  test("migration の SQL が photos へ足した列と過不足なく一致する", () => {
    const dir = resolve(import.meta.dir, "../../../drizzle");
    const files = [
      "0003_material_apocalypse.sql",
      "0004_flowery_bloodstorm.sql",
      "0005_mysterious_madame_masque.sql",
    ];
    const fromSql = files.flatMap((f) =>
      [...readFileSync(resolve(dir, f), "utf8").matchAll(
        /ALTER TABLE `photos` ADD `([a-z_]+)` ([^;]+?)(?:;|--)/g,
      )].map(([, name, rest]) => ({
        name,
        // `text DEFAULT 'legacy' NOT NULL` と `text NOT NULL DEFAULT 'legacy'` を
        // 同じものとして比べる。語順は drizzle の生成器の都合で変わる。
        base: rest.trim().split(/\s+/)[0],
        notNull: /NOT NULL/i.test(rest),
        default: rest.match(/DEFAULT\s+('[^']*'|\S+)/i)?.[1] ?? null,
      })),
    );

    const fromConst = TURSO_SAFETY_NET_COLUMNS.map(([, name, type]) => ({
      name,
      base: type.trim().split(/\s+/)[0],
      notNull: /NOT NULL/i.test(type),
      default: type.match(/DEFAULT\s+('[^']*'|\S+)/i)?.[1] ?? null,
    }));

    const sortByName = <T extends { name: string }>(a: T[]) =>
      [...a].sort((x, y) => x.name.localeCompare(y.name));
    expect(sortByName(fromConst)).toEqual(sortByName(fromSql));
  });
});

describe("ensureColumnsExist — 新規環境", () => {
  test("16列すべてが足される", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);

    const result = await ensureColumnsExist(db);

    expect(result.added).toHaveLength(16);
    expect(result.present).toHaveLength(0);
    expect(result.failed).toEqual([]);

    const names = await columnNames(db);
    for (const [, col] of TURSO_SAFETY_NET_COLUMNS) {
      expect(names).toContain(col);
    }
  });

  test("足した列は既定値まで正しく効く（shot_at_source は legacy）", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);
    await ensureColumnsExist(db);

    await db.run(sql`INSERT INTO photos (filename, url) VALUES ('a.jpg', '/a')`);
    const [row] = (await db.all(
      sql`SELECT shot_at_source, rotation_deg, focal_x, camera_model FROM photos`,
    )) as { [k: string]: unknown }[];

    expect(row.shot_at_source).toBe("legacy");
    expect(row.rotation_deg).toBe(0);
    expect(row.focal_x).toBe(50);
    expect(row.camera_model).toBeNull();
  });
});

describe("ensureColumnsExist — 既存環境", () => {
  test("2回目は1列も足さない（余計な変更が走らない）", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);
    await ensureColumnsExist(db);

    const second = await ensureColumnsExist(db);

    expect(second.added).toEqual([]);
    expect(second.present).toHaveLength(16);
    expect(second.failed).toEqual([]);
  });

  test("列が揃っていれば ALTER TABLE を1本も発行しない", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);
    await ensureColumnsExist(db);

    // 実際に流れたSQLを覗く。SELECT の存在確認だけで済むことを確かめる。
    const issued: string[] = [];
    const spy: ColumnRunner = {
      run: async (query: SQL) => {
        issued.push(JSON.stringify(query));
        return db.run(query);
      },
    };
    await ensureColumnsExist(spy);

    expect(issued).toHaveLength(16);
    expect(issued.some((q) => q.includes("ALTER"))).toBe(false);
  });

  test("一部だけ欠けている場合、欠けている分しか足さない", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);
    await db.run(sql`ALTER TABLE photos ADD COLUMN focal_length text`);
    await db.run(sql`ALTER TABLE photos ADD COLUMN iso text`);

    const result = await ensureColumnsExist(db);

    expect(result.present.sort()).toEqual(["photos.focal_length", "photos.iso"]);
    expect(result.added).toHaveLength(14);
  });
});

describe("ensureColumnsExist — 失敗しても起動を止めない", () => {
  test("ALTER が失敗した列は failed に入り、後続の列は処理が続く", async () => {
    const db = freshDb();
    await createLegacyPhotos(db);

    const broken: ColumnRunner = {
      run: async (query: SQL) => {
        const text = JSON.stringify(query);
        // rotation_deg の ALTER だけを落とす。SELECT 側は素通りさせる。
        if (text.includes("ALTER") && text.includes("rotation_deg")) {
          throw new Error("simulated ALTER failure");
        }
        return db.run(query);
      },
    };

    const result = await ensureColumnsExist(broken);

    expect(result.failed).toEqual(["photos.rotation_deg"]);
    expect(result.added).toHaveLength(15);
    // 失敗の後ろにある列（0005 の7列）まで到達している。
    expect(await columnNames(db)).toContain("camera_model");
  });
});
