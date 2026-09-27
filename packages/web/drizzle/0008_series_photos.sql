CREATE TABLE `series_photos` (
	`series_id` integer NOT NULL,
	`photo_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`series_id`, `photo_id`)
);
--> statement-breakpoint
CREATE INDEX `series_photos_photo_idx` ON `series_photos` (`photo_id`);--> statement-breakpoint
INSERT INTO `series_photos` (`series_id`, `photo_id`, `sort_order`) SELECT `series_id`, `id`, `sort_order` FROM `photos` WHERE `series_id` IS NOT NULL;
