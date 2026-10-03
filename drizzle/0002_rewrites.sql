CREATE TABLE `rewrites` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` integer NOT NULL,
	`namespace` text DEFAULT 'live' NOT NULL,
	`actor_id` text,
	`source` text NOT NULL,
	`stage` text NOT NULL,
	`original` text NOT NULL,
	`rewritten` text NOT NULL,
	`before_score` integer NOT NULL,
	`after_score` integer NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rewrites_patient_idx` ON `rewrites` (`patient_id`,`at`);