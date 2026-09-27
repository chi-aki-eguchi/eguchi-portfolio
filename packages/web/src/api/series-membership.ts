// シリーズと写真の結びつき（多対多、2026-09-26）を読み書きする場所。
//
// 正本は `series_photos`。1枚の写真を何本のシリーズにも入れられ、並び順は
// シリーズごとに持つ。
//
// `photos.series_id` は「代表のシリーズ」として残す。いつもの構成（配布版）の
// 画面・サイトマップ・写真1枚のページは、今までどおりこの1本を読む。
// **結びつきを変えたら、必ず `syncPrimarySeries` で代表をそろえる。** ここを
// 通らずに `series_id` だけを書くと、起動時の修復（migrate.ts）まで食い違う。
//
// 表の定義は呼ぶ側から受け取る（本番は `./database` の切り替え済みの schema、
// テストは SQLite の schema）。ここで `./database` を読むと、テストが本物の
// 接続を作ろうとしてしまう。
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { db as DefaultDb } from "./database";
import type * as SqliteSchema from "./database/schema";

type Schema = typeof SqliteSchema;

/** 本体の db と transaction の両方で使えるよう、必要な操作だけを求める。 */
export type MembershipDb = Pick<typeof DefaultDb, "select" | "insert" | "update" | "delete">;

export type Membership = { seriesId: number; photoId: number; sortOrder: number };

/** 結びつきを扱う関数一式を、渡された表の定義で作る。 */
export function seriesMembership(schema: Schema) {
  /**
   * 写真ごとの所属を、シリーズの並び順で返す（先頭が代表になる）。
   * `photoIds` を省くと全部の写真。
   */
  async function membershipsByPhoto(
    q: MembershipDb,
    photoIds?: number[],
  ): Promise<Map<number, number[]>> {
    if (photoIds && photoIds.length === 0) return new Map();
    const base = q
      .select({
        photoId: schema.seriesPhotos.photoId,
        seriesId: schema.seriesPhotos.seriesId,
      })
      .from(schema.seriesPhotos)
      // シリーズの行が見つからない結びつき（消し損ねた古いデータ）も落とさず、
      // 並びの最後に置く。落とすと代表の列が黙って空になる。
      .leftJoin(schema.series, eq(schema.series.id, schema.seriesPhotos.seriesId));
    const rows = await (photoIds
      ? base.where(inArray(schema.seriesPhotos.photoId, photoIds))
      : base
    ).orderBy(
      sql`coalesce(${schema.series.sortOrder}, 2147483647)`,
      asc(schema.seriesPhotos.seriesId),
    );
    const out = new Map<number, number[]>();
    for (const r of rows) {
      const list = out.get(r.photoId);
      if (list) list.push(r.seriesId);
      else out.set(r.photoId, [r.seriesId]);
    }
    return out;
  }

  /** 全部の結びつき（管理画面の作業用）。 */
  async function allMemberships(q: MembershipDb): Promise<Membership[]> {
    return q
      .select({
        seriesId: schema.seriesPhotos.seriesId,
        photoId: schema.seriesPhotos.photoId,
        sortOrder: schema.seriesPhotos.sortOrder,
      })
      .from(schema.seriesPhotos)
      .orderBy(asc(schema.seriesPhotos.seriesId), asc(schema.seriesPhotos.sortOrder));
  }

  /** 代表のシリーズ（`photos.series_id`）を、結びつきに合わせてそろえる。 */
  async function syncPrimarySeries(q: MembershipDb, photoIds: number[]): Promise<void> {
    const ids = [...new Set(photoIds)];
    if (ids.length === 0) return;
    const byPhoto = await membershipsByPhoto(q, ids);
    const groups = new Map<number | null, number[]>();
    for (const id of ids) {
      const primary = byPhoto.get(id)?.[0] ?? null;
      const list = groups.get(primary);
      if (list) list.push(id);
      else groups.set(primary, [id]);
    }
    for (const [primary, group] of groups)
      await q
        .update(schema.photos)
        .set({ seriesId: primary })
        .where(inArray(schema.photos.id, group));
  }

  /** シリーズの最後へ足す（既に入っている写真はそのまま）。渡した順に並ぶ。 */
  async function addPhotosToSeries(
    q: MembershipDb,
    seriesId: number,
    photoIds: number[],
  ): Promise<void> {
    const ids = [...new Set(photoIds)];
    if (ids.length === 0) return;
    const existing = await q
      .select({ photoId: schema.seriesPhotos.photoId })
      .from(schema.seriesPhotos)
      .where(
        and(
          eq(schema.seriesPhotos.seriesId, seriesId),
          inArray(schema.seriesPhotos.photoId, ids),
        ),
      );
    const have = new Set(existing.map((r) => r.photoId));
    const fresh = ids.filter((id) => !have.has(id));
    if (fresh.length > 0) {
      const [row] = await q
        .select({ max: sql<number | null>`max(${schema.seriesPhotos.sortOrder})` })
        .from(schema.seriesPhotos)
        .where(eq(schema.seriesPhotos.seriesId, seriesId));
      const start = Number(row?.max ?? -1) + 1;
      await q
        .insert(schema.seriesPhotos)
        .values(fresh.map((photoId, i) => ({ seriesId, photoId, sortOrder: start + i })))
        .onConflictDoNothing();
    }
    await syncPrimarySeries(q, ids);
  }

  /** シリーズから外す（写真そのものは消さない）。 */
  async function removePhotosFromSeries(
    q: MembershipDb,
    seriesId: number,
    photoIds: number[],
  ): Promise<void> {
    const ids = [...new Set(photoIds)];
    if (ids.length === 0) return;
    await q
      .delete(schema.seriesPhotos)
      .where(
        and(
          eq(schema.seriesPhotos.seriesId, seriesId),
          inArray(schema.seriesPhotos.photoId, ids),
        ),
      );
    await syncPrimarySeries(q, ids);
  }

  /**
   * 所属を「このシリーズ1本だけ」（null なら無し）に置き換える。
   *
   * いつもの構成の管理画面が `seriesId` を1つだけ送ってくる経路のため。あちらの
   * 画面では1枚1シリーズなので、送られた1本に置き換えるのが今までと同じ意味になる。
   */
  async function replaceMemberships(
    q: MembershipDb,
    photoIds: number[],
    seriesId: number | null,
  ): Promise<void> {
    const ids = [...new Set(photoIds)];
    if (ids.length === 0) return;
    const keep =
      seriesId == null
        ? []
        : await q
            .select({ photoId: schema.seriesPhotos.photoId })
            .from(schema.seriesPhotos)
            .where(
              and(
                eq(schema.seriesPhotos.seriesId, seriesId),
                inArray(schema.seriesPhotos.photoId, ids),
              ),
            );
    // 既に入っている写真は、そのシリーズの中の位置を保つ。
    const already = new Set(keep.map((r) => r.photoId));
    await q.delete(schema.seriesPhotos).where(
      seriesId == null
        ? inArray(schema.seriesPhotos.photoId, ids)
        : and(
            inArray(schema.seriesPhotos.photoId, ids),
            sql`${schema.seriesPhotos.seriesId} <> ${seriesId}`,
          ),
    );
    if (seriesId != null)
      await addPhotosToSeries(
        q,
        seriesId,
        ids.filter((id) => !already.has(id)),
      );
    await syncPrimarySeries(q, ids);
  }

  /**
   * シリーズの中の並びを決め直す。`photoIds` はそのシリーズの写真**全部**で
   * なければならない（1枚でも足りない・余ると、画面が古い一覧を見ていたとみなして断る）。
   */
  async function reorderSeriesPhotos(
    q: MembershipDb,
    seriesId: number,
    photoIds: number[],
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const current = await q
      .select({ photoId: schema.seriesPhotos.photoId })
      .from(schema.seriesPhotos)
      .where(eq(schema.seriesPhotos.seriesId, seriesId));
    const have = new Set(current.map((r) => r.photoId));
    const next = new Set(photoIds);
    if (
      next.size !== photoIds.length ||
      next.size !== have.size ||
      photoIds.some((id) => !have.has(id))
    )
      return { ok: false, error: "The series changed. Reload and try again." };
    for (let i = 0; i < photoIds.length; i++)
      await q
        .update(schema.seriesPhotos)
        .set({ sortOrder: i })
        .where(
          and(
            eq(schema.seriesPhotos.seriesId, seriesId),
            eq(schema.seriesPhotos.photoId, photoIds[i]!),
          ),
        );
    return { ok: true };
  }

  /** シリーズを消すとき、その結びつきも消して代表をそろえる。 */
  async function deleteSeriesMemberships(q: MembershipDb, seriesId: number): Promise<void> {
    const rows = await q
      .select({ photoId: schema.seriesPhotos.photoId })
      .from(schema.seriesPhotos)
      .where(eq(schema.seriesPhotos.seriesId, seriesId));
    await q.delete(schema.seriesPhotos).where(eq(schema.seriesPhotos.seriesId, seriesId));
    // 代表がこのシリーズだった写真（結びつきの無い古い行も含む）を拾い直す。
    const legacy = await q
      .select({ id: schema.photos.id })
      .from(schema.photos)
      .where(eq(schema.photos.seriesId, seriesId));
    await syncPrimarySeries(q, [...rows.map((r) => r.photoId), ...legacy.map((r) => r.id)]);
  }

  /** 写真を完全に消すとき、その結びつきも消す。 */
  async function deletePhotoMemberships(q: MembershipDb, photoIds: number[]): Promise<void> {
    if (photoIds.length === 0) return;
    await q.delete(schema.seriesPhotos).where(inArray(schema.seriesPhotos.photoId, photoIds));
  }

  /** 写真を複製したとき、同じシリーズへ（各シリーズの最後に）入れる。 */
  async function copyMemberships(
    q: MembershipDb,
    fromPhotoId: number,
    toPhotoId: number,
  ): Promise<void> {
    const rows = await q
      .select({ seriesId: schema.seriesPhotos.seriesId })
      .from(schema.seriesPhotos)
      .where(eq(schema.seriesPhotos.photoId, fromPhotoId));
    if (rows.length === 0) {
      // 結びつきがまだ無い古い写真（代表の列だけを持つ）は、その代表を写す。
      const [src] = await q
        .select({ seriesId: schema.photos.seriesId })
        .from(schema.photos)
        .where(eq(schema.photos.id, fromPhotoId))
        .limit(1);
      if (src?.seriesId != null)
        await addPhotosToSeries(q, src.seriesId, [fromPhotoId, toPhotoId]);
      return;
    }
    for (const r of rows) await addPhotosToSeries(q, r.seriesId, [toPhotoId]);
    await syncPrimarySeries(q, [toPhotoId]);
  }

  return {
    membershipsByPhoto,
    allMemberships,
    syncPrimarySeries,
    addPhotosToSeries,
    removePhotosFromSeries,
    replaceMemberships,
    reorderSeriesPhotos,
    deleteSeriesMemberships,
    deletePhotoMemberships,
    copyMemberships,
  };
}

export type SeriesMembership = ReturnType<typeof seriesMembership>;
