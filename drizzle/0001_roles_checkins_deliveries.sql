CREATE TABLE `outbox_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`touchpoint_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`namespace` text DEFAULT 'live' NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`vendor_ref` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_deliveries_tp_idx` ON `outbox_deliveries` (`touchpoint_id`);--> statement-breakpoint
CREATE INDEX `outbox_deliveries_ns_idx` ON `outbox_deliveries` (`namespace`,`at`);--> statement-breakpoint
CREATE TABLE `patient_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` integer NOT NULL,
	`token` text NOT NULL,
	`status` text NOT NULL,
	`answers` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_checkins_token_unique` ON `patient_checkins` (`token`);--> statement-breakpoint
CREATE INDEX `patient_checkins_patient_idx` ON `patient_checkins` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `audit_events` ADD `actor_id` text;--> statement-breakpoint
ALTER TABLE `persona_runs` ADD `namespace` text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE `persona_runs` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `persona_runs` ADD `approved_by` text;--> statement-breakpoint
CREATE INDEX `persona_runs_ns_idx` ON `persona_runs` (`namespace`);--> statement-breakpoint
ALTER TABLE `touchpoints` ADD `namespace` text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE `touchpoints` ADD `prepared_by` text;--> statement-breakpoint
ALTER TABLE `touchpoints` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `touchpoints` ADD `sent_at` text;--> statement-breakpoint
CREATE INDEX `touchpoints_ns_idx` ON `touchpoints` (`namespace`);