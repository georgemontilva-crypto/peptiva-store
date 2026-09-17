CREATE TABLE `coa_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(191) NOT NULL,
	`size` int NOT NULL,
	`data` longblob NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coa_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `title` varchar(120);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `spec_purity` varchar(32);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `appearance` varchar(120);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `identity` varchar(64);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `measured` varchar(191);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `heavy_metals` varchar(64);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `endotoxin` varchar(64);--> statement-breakpoint
ALTER TABLE `coa_lots` ADD `latest` boolean DEFAULT false NOT NULL;