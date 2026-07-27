import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { photos as postgresPhotos } from "./database/schema.postgres";
import { photos as sqlitePhotos } from "./database/schema";

const source = readFileSync(import.meta.dir + "/index.ts", "utf8");
const definition = source.match(
  /const PHOTO_LIST_COLUMNS = \{\n(?<body>[\s\S]*?)\n\} as const;/,
);
const entries = Array.from(
  definition?.groups?.body.matchAll(
    /^\s+(\w+): schema\.photos\.(\w+),$/gm,
  ) ?? [],
);
const responseKeys = entries.map(([, responseKey]) => responseKey);
const selectedColumnKeys = entries.map(([, , columnKey]) => columnKey);
const schemaOnlyMetadataColumnKeys = [
  "shotAtDigitized",
  "sourceWidth",
  "sourceHeight",
  "sourceFormat",
  "cameraMake",
  "cameraModel",
];
const sqliteColumnKeys = Object.keys(getTableColumns(sqlitePhotos));
const postgresColumnKeys = Object.keys(getTableColumns(postgresPhotos));
const photoWithThumbsSource = source.slice(
  source.indexOf("function photoWithThumbs"),
  source.indexOf("function keyToPublicUrl"),
);

describe("photo list columns", () => {
  test("keeps the existing photo response keys and order explicit", () => {
    expect(definition).not.toBeNull();
    const expectedListResponseKeys = [
      "id",
      "filename",
      "url",
      "title",
      "meta",
      "camera",
      "lens",
      "focalLength",
      "fNumber",
      "exposureTime",
      "iso",
      "filmType",
      "shotAt",
      "description",
      "category",
      "displaySize",
      "isPublished",
      "seriesId",
      "width",
      "height",
      "rotationDeg",
      "focalX",
      "focalY",
      "fileHash",
      "thumbKey",
      "mediumKey",
      "sortOrder",
      "deletedAt",
      "createdAt",
      "shotAtSource",
      "thumbUrl",
      "mediumUrl",
    ];
    expect([...responseKeys, "thumbUrl", "mediumUrl"]).toEqual(
      expectedListResponseKeys,
    );
    expect(selectedColumnKeys).toEqual(responseKeys);
    expect(responseKeys).toHaveLength(30);
    expect(responseKeys).toEqual(
      sqliteColumnKeys.filter(
        (key) => !schemaOnlyMetadataColumnKeys.includes(key),
      ),
    );
    expect(photoWithThumbsSource.indexOf("...p")).toBeLessThan(
      photoWithThumbsSource.indexOf("thumbUrl: p.thumbKey"),
    );
    expect(
      photoWithThumbsSource.indexOf("thumbUrl: p.thumbKey"),
    ).toBeLessThan(
      photoWithThumbsSource.indexOf("mediumUrl: p.mediumKey"),
    );
  });

  test("adds only shotAtSource and keeps the other six source metadata columns out", () => {
    expect(sqliteColumnKeys).toContain("shotAtSource");
    expect(responseKeys).toContain("shotAtSource");
    for (const key of schemaOnlyMetadataColumnKeys) {
      expect(sqliteColumnKeys).toContain(key);
      expect(responseKeys).not.toContain(key);
    }
  });

  test("keeps SQLite and Postgres photo columns in sync", () => {
    expect(postgresColumnKeys).toEqual(sqliteColumnKeys);
  });

  test("uses the shared column definition in exactly the three photo list queries", () => {
    expect(source.match(/\.select\(PHOTO_LIST_COLUMNS\)/g)).toHaveLength(3);
  });
});
