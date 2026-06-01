ALTER TABLE "days" ADD COLUMN "micro_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "micro_nag_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "micro_escalation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "days" ADD COLUMN "micro_last_nag_at" timestamp with time zone;