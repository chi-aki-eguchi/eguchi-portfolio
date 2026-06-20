CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hero_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"meta" text DEFAULT '' NOT NULL,
	"camera" text,
	"lens" text,
	"film_type" text,
	"shot_at" text,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'snap' NOT NULL,
	"display_size" text DEFAULT 'M' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"series_id" integer,
	"width" integer,
	"height" integer,
	"file_hash" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"price" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"features" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"statement" text DEFAULT '' NOT NULL,
	"cover_photo_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"theme_config" text,
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "photos_active_idx" ON "photos" USING btree ("deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "photos_series_idx" ON "photos" USING btree ("series_id","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "photos_file_hash_idx" ON "photos" USING btree ("file_hash");