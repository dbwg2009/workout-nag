CREATE TABLE IF NOT EXISTS "plan_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"session" text,
	"pressups" text,
	"pullups" text,
	"squats" text,
	"plank" text,
	"weight" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
