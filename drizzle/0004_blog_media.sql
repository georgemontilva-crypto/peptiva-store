CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` text,
	`body_html` mediumtext NOT NULL,
	`cover_image` varchar(1024),
	`cover_alt` varchar(255),
	`category` varchar(80),
	`target_keyword` varchar(191),
	`seo_title` varchar(255),
	`seo_description` varchar(512),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(191) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`size` int NOT NULL,
	`width` int,
	`height` int,
	`alt` varchar(255),
	`data` longblob NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `blog_status_idx` ON `blog_posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `media_created_idx` ON `media` (`created_at`);