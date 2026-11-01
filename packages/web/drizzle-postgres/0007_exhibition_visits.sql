CREATE TABLE "exhibition_card_days" (
	"day" text PRIMARY KEY NOT NULL,
	"people" integer DEFAULT 0 NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exhibition_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"created_at" text NOT NULL
);
