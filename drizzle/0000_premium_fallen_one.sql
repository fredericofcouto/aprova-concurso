CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`created` integer NOT NULL,
	`deadline` integer NOT NULL,
	`finished` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`open_key` text,
	`questions` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`marked` text DEFAULT '[]' NOT NULL,
	`essay` text DEFAULT '' NOT NULL,
	`essay_theme` integer DEFAULT 0 NOT NULL,
	`repeated` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_owner_created` ON `exam_attempts` (`owner`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_attempt` ON `exam_attempts` (`open_key`);