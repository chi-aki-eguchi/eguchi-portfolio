ALTER TABLE "photos" ADD COLUMN "focal_length" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "f_number" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "exposure_time" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "iso" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "rotation_deg" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "focal_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "focal_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "thumb_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "medium_key" text;