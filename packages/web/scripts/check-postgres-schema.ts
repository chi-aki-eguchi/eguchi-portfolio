import { verifyPostgresSchemaMigrations } from "../src/api/database/postgres-schema-contract";

try {
  const result = verifyPostgresSchemaMigrations();
  console.log(
    "[postgres-schema] schema, migration snapshot, and SQL agree for " +
      result.tableCount +
      " tables / " +
      result.columnCount +
      " columns.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "[postgres-schema] Unknown failure.",
  );
  process.exitCode = 1;
}
