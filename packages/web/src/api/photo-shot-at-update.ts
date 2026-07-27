import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

type ShotAtColumns = {
  shotAt: SQLWrapper;
  shotAtSource: SQLWrapper;
};

export type ShotAtPatchUpdate = {
  shotAt: string | null;
  shotAtSource: SQL<string>;
};

export function buildShotAtPatchUpdate(
  value: unknown,
  columns: ShotAtColumns,
): ShotAtPatchUpdate {
  const clearsShotAt = value === "" || value === null;
  const shotAt = clearsShotAt ? null : String(value);

  // Keep the comparison and write in one UPDATE so another request's unrelated
  // fields are never read and written back. "=" for a value and "IS NULL" for
  // null are standard in both SQLite and Postgres; SQLite-only "a IS b" is not.
  const shotAtSource = clearsShotAt
    ? sql<string>`CASE WHEN ${columns.shotAt} IS NULL THEN ${columns.shotAtSource} ELSE 'none' END`
    : sql<string>`CASE WHEN ${columns.shotAt} = ${shotAt} THEN ${columns.shotAtSource} ELSE 'manual' END`;

  return { shotAt, shotAtSource };
}
