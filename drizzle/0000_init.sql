CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `coa_lots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`lot_number` varchar(64) NOT NULL,
	`purity` varchar(32),
	`lab` varchar(191),
	`tested_at` date,
	`report_url` varchar(1024),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coa_lots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` int NOT NULL,
	`category_id` int NOT NULL,
	CONSTRAINT `product_categories_product_id_category_id_pk` PRIMARY KEY(`product_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`label` varchar(64) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`sale_price` decimal(10,2),
	`sku` varchar(64),
	`stock_status` enum('instock','outofstock') NOT NULL DEFAULT 'instock',
	`sort_order` int NOT NULL DEFAULT 0,
	`wp_id` int,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL,
	`short_description` text,
	`description_html` mediumtext,
	`price` decimal(10,2) NOT NULL,
	`sale_price` decimal(10,2),
	`image_url` varchar(1024),
	`gallery` json,
	`seo_title` varchar(255),
	`seo_description` varchar(512),
	`status` enum('active','draft') NOT NULL DEFAULT 'active',
	`stock_status` enum('instock','outofstock') NOT NULL DEFAULT 'instock',
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`wp_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `coa_lots` ADD CONSTRAINT `coa_lots_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coa_product_idx` ON `coa_lots` (`product_id`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);