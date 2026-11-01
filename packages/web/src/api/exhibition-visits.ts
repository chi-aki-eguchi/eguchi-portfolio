import { count, desc, sql } from "drizzle-orm";
import { db, schema, withRetry } from "./database";
import { exhibitionDay } from "../shared/exhibition";

/** ひとことを保存する上限。IP を変えた連投で、データベースが埋まらないように。 */
const NOTES_MAX = 5000;
/** 管理画面に出す新しい順の件数。 */
const NOTES_SHOWN = 300;

/** 名刺の QR が読まれた数を足す。firstTime は、その端末が初めて読んだとき。 */
export async function recordCardScan(firstTime: boolean, now = new Date()): Promise<void> {
  const days = schema.exhibitionCardDays;
  const people = firstTime ? 1 : 0;
  await withRetry(() =>
    db
      .insert(days)
      .values({ day: exhibitionDay(now), people, opens: 1 })
      .onConflictDoUpdate({
        target: days.day,
        set: { people: sql`${days.people} + ${people}`, opens: sql`${days.opens} + 1` },
      }),
  );
}

/** ひとことを保存する。上限に達していたら false。 */
export async function addExhibitionNote(message: string, now = new Date()): Promise<boolean> {
  const notes = schema.exhibitionNotes;
  const [row] = await withRetry(() => db.select({ total: count() }).from(notes));
  if ((row?.total ?? 0) >= NOTES_MAX) return false;
  await withRetry(() => db.insert(notes).values({ message, createdAt: now.toISOString() }));
  return true;
}

/** 管理画面に出す、QR の数とひとこと。 */
export async function readExhibitionVisits() {
  const days = schema.exhibitionCardDays;
  const notes = schema.exhibitionNotes;
  const [dayRows, noteRows, totals] = await Promise.all([
    withRetry(() => db.select().from(days).orderBy(desc(days.day))),
    withRetry(() => db.select().from(notes).orderBy(desc(notes.id)).limit(NOTES_SHOWN)),
    withRetry(() => db.select({ total: count() }).from(notes)),
  ]);
  return { days: dayRows, notes: noteRows, noteTotal: totals[0]?.total ?? 0 };
}
