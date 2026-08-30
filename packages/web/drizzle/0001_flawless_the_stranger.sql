ALTER TABLE `photos` ADD `display_size` text DEFAULT 'M' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `deleted_at` integer;