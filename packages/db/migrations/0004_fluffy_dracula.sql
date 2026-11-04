CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'card', 'oxxo', 'spei', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'expired', 'refunded');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"provider" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"provider_session_id" text,
	"provider_payment_intent_id" text,
	"hosted_instructions_url" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"recorded_by_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "entry_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "currency" text DEFAULT 'MXN' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_session_unique" ON "payments" USING btree ("provider_session_id");--> statement-breakpoint
CREATE INDEX "payments_entrant_idx" ON "payments" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_unique" ON "webhook_events" USING btree ("provider","provider_event_id");