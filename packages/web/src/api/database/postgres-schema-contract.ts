import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as postgresSchema from "./schema.postgres";

type MigrationJournal = {
  entries?: Array<{ idx?: unknown; tag?: unknown }>;
};

type MigrationSnapshot = {
  tables?: Record<string, { name?: unknown; columns?: Record<string, unknown> }>;
};

export type ColumnSets = Map<string, Set<string>>;

const DEFAULT_MIGRATIONS_FOLDER = resolve(
  import.meta.dir,
  "../../../drizzle-postgres",
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function addColumn(
  columnsByTable: ColumnSets,
  tableName: string,
  columnName: string,
): void {
  const columns = columnsByTable.get(tableName) ?? new Set<string>();
  columns.add(columnName);
  columnsByTable.set(tableName, columns);
}

function schemaColumnSets(): ColumnSets {
  const columnsByTable: ColumnSets = new Map();

  for (const value of Object.values(postgresSchema)) {
    if (!(value instanceof PgTable)) continue;

    const table = value as typeof postgresSchema.photos;
    const tableName = getTableConfig(table).name;
    for (const column of Object.values(getTableColumns(table))) {
      addColumn(columnsByTable, tableName, column.name);
    }
  }

  if (columnsByTable.size === 0) {
    throw new Error("[postgres-schema] schema.postgres.ts exports no tables.");
  }

  return columnsByTable;
}

type ValidMigrationJournal = {
  entries: Array<{ idx: number; tag: string }>;
};

function readMigrationJournal(
  migrationsFolder: string,
): ValidMigrationJournal {
  const journal = readJson<MigrationJournal>(
    join(migrationsFolder, "meta", "_journal.json"),
  );
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error("[postgres-schema] migration journal has no entries.");
  }
  if (
    journal.entries.some(
      (entry) => typeof entry.idx !== "number" || typeof entry.tag !== "string",
    )
  ) {
    throw new Error("[postgres-schema] migration journal contains an invalid tag.");
  }

  return {
    entries: journal.entries as Array<{ idx: number; tag: string }>,
  };
}

function snapshotColumnSets(
  migrationsFolder: string,
  journal: ValidMigrationJournal,
): ColumnSets {
  const latest = journal.entries[journal.entries.length - 1];
  const snapshot = readJson<MigrationSnapshot>(
    join(
      migrationsFolder,
      "meta",
      String(latest.idx).padStart(4, "0") + "_snapshot.json",
    ),
  );
  if (!snapshot.tables) {
    throw new Error("[postgres-schema] latest migration snapshot has no tables.");
  }

  const columnsByTable: ColumnSets = new Map();
  for (const table of Object.values(snapshot.tables)) {
    if (typeof table.name !== "string" || !table.columns) {
      throw new Error("[postgres-schema] latest migration snapshot is malformed.");
    }
    columnsByTable.set(table.name, new Set(Object.keys(table.columns)));
  }
  return columnsByTable;
}

function migrationSqlColumnSets(
  migrationsFolder: string,
  journal: ValidMigrationJournal,
): ColumnSets {
  const columnsByTable: ColumnSets = new Map();
  const createTablePattern = /CREATE TABLE\s+"([^"]+)"\s+\(\s*([\s\S]*?)\s*\);/g;
  const createColumnPattern = /(?:^|\n)\s*"([^"]+)"\s+/g;
  const addColumnPattern =
    /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/g;

  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(migrationsFolder, tag + ".sql"), "utf8");

    for (const match of sql.matchAll(createTablePattern)) {
      const [, tableName, tableBody] = match;
      for (const columnMatch of tableBody.matchAll(createColumnPattern)) {
        addColumn(columnsByTable, tableName, columnMatch[1]);
      }
    }
    for (const match of sql.matchAll(addColumnPattern)) {
      addColumn(columnsByTable, match[1], match[2]);
    }
  }

  return columnsByTable;
}

export function findColumnSetDrift(
  expected: ColumnSets,
  actual: ColumnSets,
  expectedLabel: string,
  actualLabel: string,
): string[] {
  const drift: string[] = [];

  for (const [tableName, expectedColumns] of expected) {
    const actualColumns = actual.get(tableName);
    if (!actualColumns) {
      drift.push(
        expectedLabel + " table " + tableName + " is missing from " + actualLabel,
      );
      continue;
    }

    const missing = [...expectedColumns]
      .filter((column) => !actualColumns.has(column))
      .sort();
    if (missing.length > 0) {
      drift.push(
        expectedLabel +
          " table " +
          tableName +
          " has columns missing from " +
          actualLabel +
          ": " +
          missing.join(", "),
      );
    }
  }

  for (const tableName of actual.keys()) {
    if (!expected.has(tableName)) {
      drift.push(
        actualLabel + " table " + tableName + " is absent from " + expectedLabel,
      );
    }
  }

  return drift;
}

export function verifyPostgresSchemaMigrations(
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
): { tableCount: number; columnCount: number } {
  const journal = readMigrationJournal(migrationsFolder);
  const schemaColumns = schemaColumnSets();
  const snapshotColumns = snapshotColumnSets(migrationsFolder, journal);
  const migrationSqlColumns = migrationSqlColumnSets(migrationsFolder, journal);
  const drift = [
    ...findColumnSetDrift(
      schemaColumns,
      snapshotColumns,
      "schema.postgres.ts",
      "migration snapshot",
    ),
    ...findColumnSetDrift(
      snapshotColumns,
      migrationSqlColumns,
      "migration snapshot",
      "migration SQL",
    ),
  ];

  if (drift.length > 0) {
    throw new Error(
      "[postgres-schema] Drift detected:\n- " +
        drift.join("\n- ") +
        "\nRun: cd packages/web && bunx drizzle-kit generate --config=drizzle.postgres.config.ts",
    );
  }

  return {
    tableCount: schemaColumns.size,
    columnCount: [...schemaColumns.values()].reduce(
      (count, columns) => count + columns.size,
      0,
    ),
  };
}
