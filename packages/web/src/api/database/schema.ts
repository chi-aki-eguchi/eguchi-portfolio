import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// 写真テーブル
export const photos = sqliteTable("photos", {
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
  filmType: text("film_type"), // "フィルム" | "デジタル"
  // U2: 撮影日時 (ISO "YYYY-MM-DD[THH:mm:ss]") — アップロード時に EXIF
  // DateTimeOriginal から自動設定。EXIF が無い写真は null（手入力も可）。
  shotAt: text("shot_at"),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("snap"),
  displaySize: text("display_size").notNull().default("M"), // S, M, L
  // M2: public visibility flag, independent of category/series. Defaults to true
  // so existing photos stay visible. Public listings filter on this; admin sees all.
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  // I1: optional membership in a series (作品群). Nullable — a photo can belong
  // to one series or none. Kept independent of `category` (分類 vs 作品群).
  seriesId: integer("series_id"),
  // Intrinsic dimensions of the stored (optimised) image — used to reserve
  // aspect-ratio on the client and avoid layout shift (CLS) before load.
  width: integer("width"),
  height: integer("height"),
  // SHA-256 of the optimised (stored) image — used to detect duplicate uploads.
  // Hashed post-optimisation so it matches the bytes actually in R2 (enables backfill).
  fileHash: text("file_hash"),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (t) => [
  // These queries currently full-scan the photos table, so they slow down linearly
  // as the library grows to 100s of photos. Apply with `bun run db:push`.
  // Public/admin listing: WHERE deleted_at IS NULL ORDER BY sort_order.
  index("photos_active_idx").on(t.deletedAt, t.sortOrder),
  // Series detail: WHERE series_id = ? AND deleted_at IS NULL ORDER BY sort_order.
  index("photos_series_idx").on(t.seriesId, t.deletedAt, t.sortOrder),
  // Duplicate-upload check, run on every upload: WHERE file_hash = ?.
  index("photos_file_hash_idx").on(t.fileHash),
]);

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
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  // 機能10: シリーズ固有のレイアウト・テーマ設定（JSON文字列。null = グローバル設定に従う）
  themeConfig: text("theme_config"),
});

// 料金プランテーブル — H1（撮影依頼の料金表）
export const pricingPlans = sqliteTable("pricing_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  price: text("price").notNull().default(""),       // 例 "¥15,000〜"（自由記述）
  description: text("description").notNull().default(""),
  features: text("features").notNull().default(""), // 箇条書き・改行区切り
  note: text("note").notNull().default(""),         // 補足
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
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
