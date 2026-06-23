import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const photos = pgTable("photos", {
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
  fileHash: text("file_hash"),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: false }),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
}, (t) => [
  index("photos_active_idx").on(t.deletedAt, t.sortOrder),
  index("photos_series_idx").on(t.seriesId, t.deletedAt, t.sortOrder),
  index("photos_file_hash_idx").on(t.fileHash),
]);

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
