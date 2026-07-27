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
      "thumbUrl",
      "mediumUrl",
    ];
    expect([...responseKeys, "thumbUrl", "mediumUrl"]).toEqual(
      expectedListResponseKeys,
    );
    expect(selectedColumnKeys).toEqual(responseKeys);
    expect(responseKeys).toEqual(Object.keys(getTableColumns(sqlitePhotos)));
    expect(responseKeys).toEqual(Object.keys(getTableColumns(postgresPhotos)));
    expect(photoWithThumbsSource.indexOf("...p")).toBeLessThan(
      photoWithThumbsSource.indexOf("thumbUrl: p.thumbKey"),
    );
    expect(
      photoWithThumbsSource.indexOf("thumbUrl: p.thumbKey"),
    ).toBeLessThan(
      photoWithThumbsSource.indexOf("mediumUrl: p.mediumKey"),
    );
  });

  test("uses the shared column definition in exactly the three photo list queries", () => {
    expect(source.match(/\.select\(PHOTO_LIST_COLUMNS\)/g)).toHaveLength(3);
  });
});
