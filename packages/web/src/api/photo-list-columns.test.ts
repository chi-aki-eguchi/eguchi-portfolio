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

  // 公開サイトはどのページでも最初に GET /photos を待つ。実測（2026-08-08・
  // 写真497枚）で 409,687 bytes あり、上位は fileHash 38.8KB・mediumKey 25.3KB・
  // thumbKey 24.8KB と、どれも公開側が読まない管理用の列だった。落として
  // 295,923 bytes（-27.8%）。落としすぎると写真が出なくなるので、公開側が
  // 実際に描画に使う列が残っていることを併せて縛る。
  describe("公開応答から管理用の列だけを落とす", () => {
    const publicBranch = source.slice(
      source.indexOf("if (includeUnpublished) return c.json({ photos: withThumbs }"),
      source.indexOf("// ── Admin: Settings update ──"),
    );
    const stripped = Array.from(
      publicBranch.matchAll(/^\s+(\w+): _\w+,$/gm),
      ([, key]) => key,
    );

    test("落とすのは管理専用の6列だけ", () => {
      expect(stripped.sort()).toEqual(
        [
          "deletedAt",
          "fileHash",
          "isPublished",
          "mediumKey",
          "shotAtSource",
          "thumbKey",
        ].sort(),
      );
    });

    test("公開サイトが描画に使う列は落とさない", () => {
      // url と thumbUrl/mediumUrl は写真そのもの、width/height はレイアウトの
      // 場所取り（無いと読み込みのたびに画面がガタつく）、rotationDeg と
      // focalX/Y は向きと寄せ、filename は管理画面の写真ピッカーが
      // 同じ公開応答から読む。
      for (const key of [
        "id",
        "url",
        "thumbUrl",
        "mediumUrl",
        "width",
        "height",
        "rotationDeg",
        "focalX",
        "focalY",
        "title",
        "filename",
        "category",
        "seriesId",
        "sortOrder",
      ]) {
        expect(stripped).not.toContain(key);
      }
    });

    test("管理画面（?all=1）へは今までどおり全部返す", () => {
      expect(source).toContain(
        "if (includeUnpublished) return c.json({ photos: withThumbs }",
      );
    });
  });
});
