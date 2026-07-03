CREATE TABLE `result_players` (
	`result_id` text NOT NULL,
	`username` text NOT NULL,
	`points` integer NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`result_id`, `username`),
	FOREIGN KEY (`result_id`) REFERENCES `results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`date` text NOT NULL,
	`player_count` integer NOT NULL,
	`data` text NOT NULL
);
