// smoke（Playwright）用の人工データ。本番の写真・文章・DBは一切使わない。
//
// `scripts/smoke/isolated-server.ts` が実行ごとの一時SQLiteへ投入し、画像は
// ここで生成したものを偽ストレージが返す。テストはこのファイルの定数で
// 作品名や件数を参照する（本番データの形に依存しない）。
//
// ゴミ箱の写真は保持期間（30日）の内側だけに置く。ゴミ箱を開くと期限切れの
// 写真が削除されるため、期限切れを置くとテストの順番で共有データが変わる。
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import sharp from "sharp";
import * as schema from "../api/database/schema";

type PhotoInsert = typeof schema.photos.$inferInsert;
type SeriesInsert = typeof schema.series.$inferInsert;

export const SMOKE_SETTINGS: Record<string, string> = {
  setupCompleted: "true",
  siteName: "Smoke Fixture Studio",
  siteNameEn: "Smoke Fixture Studio",
  siteDescription: "smoke 用の人工データだけで組んだ確認用サイト",
  profileName: "検証用 写真家",
  profileBio: "この文章は自動テスト用の人工データです。",
  contactEmail: "smoke@example.invalid",
  navLabelWork: "Work",
  servicePageMode: "off",
  galleryExcludeSeries: "on",
  gallerySortOrder: "manual",
};

export const SMOKE_CATEGORIES = [
  { id: 1, slug: "snap", label: "スナップ", sortOrder: 0 },
  { id: 2, slug: "portrait", label: "ポートレート", sortOrder: 1 },
  { id: 3, slug: "landscape", label: "風景", sortOrder: 2 },
];

export const SMOKE_LONG_TITLE =
  "とても長い題名の作品を折り返しと省略の確認のために置いている人工データのシリーズ";

export const SMOKE_SERIES = {
  harbour: { id: 501, slug: "harbour-light", title: "港の光", kind: "series", isPublished: true },
  long: { id: 502, slug: "long-title", title: SMOKE_LONG_TITLE, kind: "series", isPublished: true },
  empty: { id: 503, slug: "empty-series", title: "写真のない組", kind: "series", isPublished: true },
  draft: { id: 504, slug: "draft-series", title: "非公開のシリーズ", kind: "series", isPublished: false },
  commission: { id: 601, slug: "harbour-commission", title: "港の仕事", kind: "work", isPublished: true },
  // URL で符号化が要る slug。
  encoded: { id: 602, slug: "港-2026", title: "港の記録 2026", kind: "work", isPublished: true },
  draftWork: { id: 603, slug: "draft-work", title: "非公開の仕事", kind: "work", isPublished: false },
} as const;

type ImageShape = "landscape" | "portrait";
const SIZE: Record<ImageShape, { width: number; height: number }> = {
  landscape: { width: 1200, height: 800 },
  portrait: { width: 800, height: 1200 },
};

type PhotoSeed = {
  id: number;
  shape: ImageShape;
  seriesId?: number;
  isPublished?: boolean;
  trashedDaysAgo?: number;
  film?: boolean;
  dated?: boolean;
  category?: string;
  rotationDeg?: number;
};

const DAY = 24 * 60 * 60 * 1000;

const PHOTO_SEEDS: PhotoSeed[] = [
  // Gallery に並ぶ単独の写真（公開）。
  { id: 7001, shape: "landscape", category: "snap" },
  { id: 7002, shape: "portrait", category: "portrait", film: true },
  { id: 7003, shape: "landscape", category: "landscape", dated: false },
  { id: 7004, shape: "portrait", category: "snap" },
  { id: 7005, shape: "landscape", category: "portrait", film: true },
  { id: 7006, shape: "landscape", category: "landscape", rotationDeg: 90 },
  { id: 7007, shape: "portrait", category: "snap", film: true, dated: false },
  { id: 7008, shape: "landscape", category: "snap" },
  { id: 7009, shape: "landscape", category: "snap", isPublished: false },
  // 公開シリーズ（表紙あり）と、その中の非公開写真。
  { id: 7101, shape: "landscape", seriesId: 501 },
  { id: 7102, shape: "portrait", seriesId: 501, film: true },
  { id: 7103, shape: "landscape", seriesId: 501 },
  { id: 7104, shape: "portrait", seriesId: 501 },
  { id: 7105, shape: "landscape", seriesId: 501, film: true, dated: false },
  { id: 7106, shape: "landscape", seriesId: 501 },
  { id: 7107, shape: "portrait", seriesId: 501, isPublished: false },
  { id: 7201, shape: "portrait", seriesId: 502 },
  { id: 7202, shape: "landscape", seriesId: 502 },
  { id: 7401, shape: "landscape", seriesId: 504 },
  { id: 7402, shape: "portrait", seriesId: 504 },
  { id: 7601, shape: "landscape", seriesId: 601 },
  { id: 7602, shape: "portrait", seriesId: 601 },
  { id: 7603, shape: "landscape", seriesId: 601, film: true },
  { id: 7621, shape: "landscape", seriesId: 602 },
  { id: 7631, shape: "portrait", seriesId: 603 },
  // ゴミ箱（保持期間の内側）。
  { id: 7901, shape: "landscape", trashedDaysAgo: 2 },
  { id: 7902, shape: "portrait", trashedDaysAgo: 10, seriesId: 501 },
];

export const SMOKE_HERO_PHOTO_IDS = [7001, 7101, 7601];

/** 代表のほかにもう1本のシリーズへ入っている写真。 */
export const SMOKE_SHARED_MEMBERSHIPS = [{ seriesId: 502, photoId: 7101, sortOrder: 9000 }];

export function smokeImageKeys(id: number) {
  const stem = `smoke-${id}`;
  return {
    original: `photos/${stem}.jpg`,
    thumb: `thumbs/${stem}.webp`,
    medium: `medium/${stem}.webp`,
  };
}

/** 隔離確認で画像の往復に使うキー。 */
export const SMOKE_PROBE_IMAGE_KEY = smokeImageKeys(7001).original;

function photoRow(seed: PhotoSeed, now: number): PhotoInsert {
  const keys = smokeImageKeys(seed.id);
  const { width, height } = SIZE[seed.shape];
  const dated = seed.dated !== false;
  const shot = new Date(Date.UTC(2025, seed.id % 12, 1 + (seed.id % 27), 9, 30));
  const shotAt = dated ? shot.toISOString().slice(0, 19) : null;
  return {
    id: seed.id,
    filename: `smoke-${seed.id}.${seed.film ? "tif" : "jpg"}`,
    url: `/api/images/${keys.original}`,
    thumbKey: keys.thumb,
    mediumKey: keys.medium,
    fileHash: `smoke-hash-${seed.id}`,
    width,
    height,
    title: `検証写真 ${seed.id}`,
    description: seed.id % 3 === 0 ? "人工データの説明文。" : "",
    category: seed.category ?? "snap",
    displaySize: seed.id % 4 === 0 ? "L" : "M",
    isPublished: seed.isPublished ?? true,
    seriesId: seed.seriesId ?? null,
    rotationDeg: seed.rotationDeg ?? 0,
    focalX: 50,
    focalY: 50,
    sortOrder: seed.id,
    camera: seed.film ? "Smoke Film 67" : "Smoke Digital X",
    lens: seed.film ? "Smoke 105mm F2.4" : "Smoke 35mm F1.8",
    focalLength: seed.film ? "105mm" : "35mm",
    fNumber: "f/4",
    exposureTime: "1/250",
    iso: seed.film ? "400" : "200",
    filmType: seed.film ? "フィルム" : "デジタル",
    shotAt,
    shotAtSource: dated ? (seed.film ? "manual" : "exif_original") : "none",
    shotAtDigitized: seed.film ? "2026-03-02T09:30:00" : shotAt,
    sourceWidth: width * 4,
    sourceHeight: height * 4,
    sourceFormat: seed.film ? "tiff" : "jpeg",
    cameraMake: seed.film ? "SMOKE SCANNER" : "SMOKE",
    cameraModel: seed.film ? "Scanner 1" : "Digital X",
    deletedAt:
      seed.trashedDaysAgo === undefined
        ? null
        : new Date(now - seed.trashedDaysAgo * DAY),
    createdAt: new Date(now - (8000 - seed.id) * 60_000),
  };
}

function seriesRows(): SeriesInsert[] {
  return Object.values(SMOKE_SERIES).map((s, index) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    subtitle: s.id === 501 ? "Harbour Light" : "",
    statement: s.id === 501 ? "人工データの作家の言葉。" : "",
    coverPhotoId: s.id === 501 ? 7103 : null,
    sortOrder: index,
    isPublished: s.isPublished,
    themeConfig: null,
    kind: s.kind,
  }));
}

/** 表を schema.ts から作り、人工データを入れる。既存のファイルには書かない。 */
export async function createSmokeDatabase(file: string, now = Date.now()) {
  const client = createClient({ url: `file:${file}` });
  try {
    const statements = await generateSQLiteMigration(
      await generateSQLiteDrizzleJson({}),
      await generateSQLiteDrizzleJson(schema),
    );
    for (const statement of statements) await client.execute(statement);
    const db = drizzle(client, { schema });
    await db.insert(schema.siteSettings).values(
      Object.entries(SMOKE_SETTINGS).map(([key, value]) => ({ key, value })),
    );
    await db.insert(schema.categories).values(SMOKE_CATEGORIES);
    await db.insert(schema.series).values(seriesRows());
    await db.insert(schema.photos).values(PHOTO_SEEDS.map((seed) => photoRow(seed, now)));
    // シリーズとの結びつき（多対多）。代表のシリーズ（seriesId）と同じものに加え、
    // 1枚を2本のシリーズへ同時に入れた写真を置く（7101 は港の光と長い題名の組）。
    await db.insert(schema.seriesPhotos).values([
      ...PHOTO_SEEDS.filter((seed) => seed.seriesId != null).map((seed) => ({
        seriesId: seed.seriesId!,
        photoId: seed.id,
        sortOrder: seed.id,
      })),
      ...SMOKE_SHARED_MEMBERSHIPS,
    ]);
    await db.insert(schema.heroPhotos).values(
      SMOKE_HERO_PHOTO_IDS.map((photoId, sortOrder) => ({ photoId, sortOrder })),
    );
  } finally {
    client.close();
  }
}

export type SmokeImage = { body: Uint8Array; contentType: string };

function svgFor(seed: PhotoSeed): string {
  const { width, height } = SIZE[seed.shape];
  const hue = (seed.id * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},35%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},30%,28%)"/>
</linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#g)"/>
<circle cx="${width * 0.62}" cy="${height * 0.42}" r="${Math.min(width, height) * 0.18}" fill="hsl(${hue},20%,88%)" opacity="0.7"/>
</svg>`;
}

/** 保存先に置く画像（原本の代わりのJPEGと、縮小版2つ）を人工的に作る。 */
export async function createSmokeImages(): Promise<Map<string, SmokeImage>> {
  const images = new Map<string, SmokeImage>();
  for (const seed of PHOTO_SEEDS) {
    const keys = smokeImageKeys(seed.id);
    const base = sharp(Buffer.from(svgFor(seed)));
    const jpeg = await base.clone().jpeg({ quality: 80 }).toBuffer();
    images.set(keys.original, { body: jpeg, contentType: "image/jpeg" });
    const thumb = await sharp(jpeg).resize({ width: 400 }).webp({ quality: 70 }).toBuffer();
    images.set(keys.thumb, { body: thumb, contentType: "image/webp" });
    const medium = await sharp(jpeg).resize({ width: 1000 }).webp({ quality: 75 }).toBuffer();
    images.set(keys.medium, { body: medium, contentType: "image/webp" });
  }
  return images;
}
