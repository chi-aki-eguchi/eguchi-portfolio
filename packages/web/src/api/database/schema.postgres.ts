import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    meta: text("meta").notNull().default(""),
    camera: text("camera"),
    lens: text("lens"),
    focalLength: text("focal_length"),
    fNumber: text("f_number"),
    exposureTime: text("exposure_time"),
    iso: text("iso"),
    filmType: text("film_type"),
    shotAt: text("shot_at"),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("snap"),
    displaySize: text("display_size").notNull().default("M"),
    isPublished: boolean("is_published").notNull().default(true),
    seriesId: integer("series_id"),
    width: integer("width"),
    height: integer("height"),
    rotationDeg: integer("rotation_deg").notNull().default(0),
    focalX: integer("focal_x").notNull().default(50),
    focalY: integer("focal_y").notNull().default(50),
    fileHash: text("file_hash"),
    thumbKey: text("thumb_key"),
    mediumKey: text("medium_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: false }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    // 撮影日時の出どころ。取りうる値: exif_original / exif_digitized /
    // file_modified / manual / none / legacy。
    // `legacy` はこの仕組みより前に登録された行だけが持つDB既定値。
    // アプリケーションコードからは絶対に書き込まず、新規処理が失敗しても
    // legacyへ逃がさない（デジタルはnone、フィルムはfile_modified）。
    shotAtSource: text("shot_at_source").notNull().default("legacy"),
    // 元ファイルのEXIF DateTimeDigitized。存在しない・読み取れない場合はNULL。
    shotAtDigitized: text("shot_at_digitized"),
    // sourceWidth / sourceHeight はアップロードされた元ファイルの寸法。
    // 既存のwidth / heightは保存した3200px JPEGの寸法であり、別の値。
    // どちらもEXIFの向きを適用した後の表示上の縦横。元ファイル側は
    // sharp metadata().autoOrientを使い、生のwidth / heightは使わない。
    sourceWidth: integer("source_width"),
    sourceHeight: integer("source_height"),
    // 元ファイル形式を小文字の閉じた集合
    // jpeg / png / webp / tiff / avif / heic / otherへ正規化した値。
    // NULLは読み取り失敗、otherは読み取れた未知形式。AVIFはsharpが
    // format="heif", compression="av1"と返すため、formatだけでHEICと区別しない。
    sourceFormat: text("source_format"),
    // 元ファイルのEXIF Make（メーカー名）。存在しない・読み取れない場合はNULL。
    cameraMake: text("camera_make"),
    // 元ファイルのEXIF Model（機種名）。存在しない・読み取れない場合はNULL。
    cameraModel: text("camera_model"),
  },
  (t) => [
    index("photos_active_idx").on(t.deletedAt, t.sortOrder),
    index("photos_series_idx").on(t.seriesId, t.deletedAt, t.sortOrder),
    index("photos_file_hash_idx").on(t.fileHash),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const series = pgTable("series", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  statement: text("statement").notNull().default(""),
  coverPhotoId: integer("cover_photo_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  themeConfig: text("theme_config"),
  // 棚。`"series"` = 作品群 / `"work"` = もう一組の棚（2026-08-30 オーナー依頼
  // 「work はシリーズみたいな感じで自分で他に入れれる仕組み」）。
  // **別テーブルを作らず、同じ仕組みに棚の区別だけを足す。** 分けると API・
  // 管理画面・公開ページ・写真の所属列まで二重になる。既定が `"series"` なので、
  // いま入っているものは全部そのままシリーズの棚に残る。
  kind: text("kind").notNull().default("series"),
});

export const pricingPlans = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  price: text("price").notNull().default(""),
  description: text("description").notNull().default(""),
  features: text("features").notNull().default(""),
  note: text("note").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
});

export const heroPhotos = pgTable("hero_photos", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
