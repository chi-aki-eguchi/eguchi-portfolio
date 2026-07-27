ALTER TABLE `photos` ADD `shot_at_source` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `shot_at_digitized` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `source_width` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `source_height` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `source_format` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `camera_make` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `camera_model` text;