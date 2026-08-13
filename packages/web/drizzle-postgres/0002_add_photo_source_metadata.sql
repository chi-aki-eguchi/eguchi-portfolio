ALTER TABLE "photos" ADD COLUMN "shot_at_source" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "shot_at_digitized" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source_width" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source_height" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source_format" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "camera_make" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "camera_model" text;