CREATE TABLE `abandoned_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`email` varchar(191) NOT NULL,
	`first_name` varchar(80),
	`lines` json NOT NULL,
	`coupon_code` varchar(64),
	`affiliate_code` varchar(64),
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('open','recovered','unsubscribed') NOT NULL DEFAULT 'open',
	`emails_sent` int NOT NULL DEFAULT 0,
	`last_email_at` timestamp,
	`recovered_order_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `abandoned_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `abandoned_carts_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(120),
	`password_hash` varchar(255) NOT NULL,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `admins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`landing_path` varchar(255),
	`referrer` varchar(255),
	`visitor_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(191) NOT NULL,
	`code` varchar(40) NOT NULL,
	`status` enum('pending','active','rejected','suspended') NOT NULL DEFAULT 'pending',
	`commission_rate` decimal(5,2),
	`channel` varchar(300),
	`audience` varchar(120),
	`application_note` text,
	`payout_method` varchar(40),
	`payout_details` varchar(300),
	`admin_note` text,
	`password_hash` varchar(255),
	`last_login_at` timestamp,
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_email_unique` UNIQUE(`email`),
	CONSTRAINT `affiliates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`order_id` int NOT NULL,
	`base` decimal(10,2) NOT NULL,
	`rate` decimal(5,2) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
	`source` enum('link','coupon') NOT NULL DEFAULT 'link',
	`payout_id` int,
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `commissions_order_id_unique` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`status` enum('pending','paid','on_hold','failed','cancelled','shipped','completed','refunded') NOT NULL,
	`note` varchar(500),
	`public` boolean NOT NULL DEFAULT true,
	`created_by` varchar(32) NOT NULL DEFAULT 'system',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`method` varchar(40),
	`reference` varchar(191),
	`note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `coupons` ADD `description` varchar(191);--> statement-breakpoint
ALTER TABLE `coupons` ADD `starts_at` timestamp;--> statement-breakpoint
ALTER TABLE `coupons` ADD `min_subtotal` decimal(10,2);--> statement-breakpoint
ALTER TABLE `coupons` ADD `per_customer_limit` int;--> statement-breakpoint
ALTER TABLE `coupons` ADD `affiliate_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `carrier` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_url` varchar(512);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `completed_at` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `admin_note` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `affiliate_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `cart_token` varchar(64);--> statement-breakpoint
ALTER TABLE `affiliate_tokens` ADD CONSTRAINT `affiliate_tokens_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliate_visits` ADD CONSTRAINT `affiliate_visits_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commissions` ADD CONSTRAINT `commissions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `abandoned_status_idx` ON `abandoned_carts` (`status`);--> statement-breakpoint
CREATE INDEX `abandoned_email_idx` ON `abandoned_carts` (`email`);--> statement-breakpoint
CREATE INDEX `visits_affiliate_idx` ON `affiliate_visits` (`affiliate_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `affiliates_status_idx` ON `affiliates` (`status`);--> statement-breakpoint
CREATE INDEX `commissions_affiliate_idx` ON `commissions` (`affiliate_id`,`status`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);