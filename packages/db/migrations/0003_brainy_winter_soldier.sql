CREATE TYPE "public"."division" AS ENUM('open', 'mens', 'womens');--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_tournament_category_discipline_unique";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "division" "division" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tournament_category_discipline_unique" UNIQUE("tournament_id","category_id","discipline","division");