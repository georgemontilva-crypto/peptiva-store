CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(191) NOT NULL,
	`subject` varchar(191),
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`type` enum('percent','fixed') NOT NULL DEFAULT 'percent',
	`amount` decimal(10,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`expires_at` timestamp,
	`usage_limit` int,
	`usage_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`source` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`variant_id` int,
	`name` varchar(191) NOT NULL,
	`variant_label` varchar(64),
	`unit_price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL,
	`bundle_percent` int NOT NULL DEFAULT 0,
	`line_total` decimal(10,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`access_key` varchar(64) NOT NULL,
	`status` enum('pending','paid','on_hold','failed','cancelled','shipped','completed','refunded') NOT NULL DEFAULT 'pending',
	`email` varchar(191) NOT NULL,
	`first_name` varchar(80) NOT NULL,
	`last_name` varchar(80) NOT NULL,
	`phone` varchar(32),
	`address1` varchar(200) NOT NULL,
	`address2` varchar(200),
	`city` varchar(100) NOT NULL,
	`state` varchar(2) NOT NULL,
	`zip` varchar(20) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'US',
	`subtotal` decimal(10,2) NOT NULL,
	`bundle_discount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`coupon_code` varchar(64),
	`coupon_discount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`shipping_total` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`customer_note` text,
	`research_acknowledged` boolean NOT NULL DEFAULT false,
	`payment_transaction_id` varchar(128),
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int,
	`kind` varchar(32),
	`trans_status` varchar(32),
	`transaction_id` varchar(128),
	`signature_valid` boolean NOT NULL,
	`outcome` varchar(64) NOT NULL,
	`payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `payment_events_order_idx` ON `payment_events` (`order_id`);