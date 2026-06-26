ALTER TABLE `photos` ADD `rotation_deg` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `focal_x` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `focal_y` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `thumb_key` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `medium_key` text;