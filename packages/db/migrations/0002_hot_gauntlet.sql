ALTER TABLE "entrants" ADD COLUMN "paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "contact_phone" text;