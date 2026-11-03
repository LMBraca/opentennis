CREATE TABLE "sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "court_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "match_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "min_rest_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "availability_windows" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");