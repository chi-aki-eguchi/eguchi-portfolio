import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// 写真テーブル
export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    // Legacy free-text meta — kept as a migration safety net; new UI uses the
    // structured camera/lens/filmType fields below and no longer writes here.
    meta: text("meta").notNull().default(""),
    // D3: structured capture info (all nullable — film/manual gear has no EXIF)
    camera: text("camera"),
    lens: text("lens"),
    focalLength: text("focal_length"),
    fNumber: text("f_number"),
    exposureTime: text("exposure_time"),
    iso: text("iso"),
    filmType: text("film_type"), // "フィルム" | "デジタル"
    // U2: 撮影日時 (ISO "YYYY-MM-DD[THH:mm:ss]") — アップロード時に EXIF
    // DateTimeOriginal から自動設定。EXIF が無い写真は null（手入力も可）。
    shotAt: text("shot_at"),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("snap"),
    displaySize: text("display_size").notNull().default("M"), // S, M, L
    // M2: public visibility flag, independent of category/series. Defaults to true
    // so existing photos stay visible. Public listings filter on this; admin sees all.
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    // I1: optional membership in a series (作品群). Nullable — a photo can belong
    // to one series or none. Kept independent of `category` (分類 vs 作品群).
    seriesId: integer("series_id"),
    // Intrinsic dimensions of the stored (optimised) image — used to reserve
    // aspect-ratio on the client and avoid layout shift (CLS) before load.
    width: integer("width"),
    height: integer("height"),
    // V3: non-destructive presentation controls. The stored R2 object is not
    // rewritten; the image proxy/rendering pipeline applies these values.
    rotationDeg: integer("rotation_deg").notNull().default(0), // 0 | 90 | 180 | 270
    focalX: integer("focal_x").notNull().default(50), // 0-100
    focalY: integer("focal_y").notNull().default(50), // 0-100
    // SHA-256 of the optimised (stored) image — used to detect duplicate uploads.
    // Hashed post-optimisation so it matches the bytes actually in R2 (enables backfill).
    fileHash: text("file_hash"),
    thumbKey: text("thumb_key"),
    mediumKey: text("medium_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
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
    // These queries currently full-scan the photos table, so they slow down linearly
    // as the library grows to 100s of photos. Apply with `bun run db:push`.
    // Public/admin listing: WHERE deleted_at IS NULL ORDER BY sort_order.
    index("photos_active_idx").on(t.deletedAt, t.sortOrder),
    // Series detail: WHERE series_id = ? AND deleted_at IS NULL ORDER BY sort_order.
    index("photos_series_idx").on(t.seriesId, t.deletedAt, t.sortOrder),
    // Duplicate-upload check, run on every upload: WHERE file_hash = ?.
    index("photos_file_hash_idx").on(t.fileHash),
  ],
);

// カテゴリテーブル
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// シリーズ（作品集のまとまり）テーブル — I1
export const series = sqliteTable("series", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  statement: text("statement").notNull().default(""), // コンセプト文
  coverPhotoId: integer("cover_photo_id"), // 表紙写真（nullable）
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(true),
  // 機能10: シリーズ固有のレイアウト・テーマ設定（JSON文字列。null = グローバル設定に従う）
  themeConfig: text("theme_config"),
  // 棚。`"series"` = 作品群 / `"work"` = もう一組の棚（2026-08-30 オーナー依頼
  // 「work はシリーズみたいな感じで自分で他に入れれる仕組み」）。
  // **別テーブルを作らず、同じ仕組みに棚の区別だけを足す。** 分けると API・
  // 管理画面・公開ページ・写真の所属列まで二重になる。既定が `"series"` なので、
  // いま入っているものは全部そのままシリーズの棚に残る。
  kind: text("kind").notNull().default("series"),
});

// 料金プランテーブル — H1（撮影依頼の料金表）
export const pricingPlans = sqliteTable("pricing_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  price: text("price").notNull().default(""), // 例 "¥15,000〜"（自由記述）
  description: text("description").notNull().default(""),
  features: text("features").notNull().default(""), // 箇条書き・改行区切り
  note: text("note").notNull().default(""), // 補足
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(true),
});

// ヒーロー写真テーブル（選んだ写真をトップに表示）
export const heroPhotos = sqliteTable("hero_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  photoId: integer("photo_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// サイト設定テーブル（key-value形式）
export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
