CREATE SCHEMA "offchain";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offchain"."metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" text
);
