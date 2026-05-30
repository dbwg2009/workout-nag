CREATE TYPE "public"."day_status" AS ENUM('pending', 'proven', 'rest', 'overridden', 'missed');--> statement-breakpoint
CREATE TYPE "public"."override_kind" AS ENUM('rest', 'sick', 'exam', 'snooze');--> statement-breakpoint
CREATE TYPE "public"."proof_kind" AS ENUM('photo', 'tracker');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "days" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"is_training_day" boolean DEFAULT false NOT NULL,
	"session_name" text,
	"status" "day_status" DEFAULT 'pending' NOT NULL,
	"proven_at" timestamp with time zone,
	"nag_count" integer DEFAULT 0 NOT NULL,
	"escalation" integer DEFAULT 0 NOT NULL,
	"last_nag_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nudges" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"escalation" integer DEFAULT 0 NOT NULL,
	"channel" text DEFAULT 'discord' NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "override_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer,
	"kind" "proof_kind" NOT NULL,
	"hash" text NOT NULL,
	"exif_taken_at" timestamp with time zone,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"wake_start" text DEFAULT '09:00' NOT NULL,
	"wake_end" text DEFAULT '21:00' NOT NULL,
	"training_days" jsonb DEFAULT '["tue","thu","fri","sat"]'::jsonb NOT NULL,
	"max_nags_per_day" integer DEFAULT 6 NOT NULL,
	"tz" text DEFAULT 'Europe/London' NOT NULL,
	"model" text DEFAULT 'meta-llama/llama-3.3-70b-instruct:free' NOT NULL,
	"persona_name" text DEFAULT 'Sarge' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nudges" ADD CONSTRAINT "nudges_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proofs" ADD CONSTRAINT "proofs_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "days_date_unique" ON "days" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proofs_hash_unique" ON "proofs" USING btree ("hash");