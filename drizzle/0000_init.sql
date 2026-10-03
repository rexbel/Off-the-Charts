CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`patient_id` integer,
	`run_id` text,
	`touchpoint_id` text,
	`meta` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patient_contexts` (
	`patient_id` integer PRIMARY KEY NOT NULL,
	`checkin` text NOT NULL,
	`audience` text NOT NULL,
	`language` text NOT NULL,
	`channel` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `persona_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`confirmed_claim_ids` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `persona_runs_patient_idx` ON `persona_runs` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`kind` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`text` text NOT NULL,
	`original_text` text NOT NULL,
	`decided_at` text,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `touchpoints_run_idx` ON `touchpoints` (`run_id`);--> statement-breakpoint
CREATE INDEX `touchpoints_status_idx` ON `touchpoints` (`status`);