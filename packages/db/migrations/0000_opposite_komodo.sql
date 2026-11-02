CREATE TYPE "public"."deciding_set_mode" AS ENUM('standard', 'matchTiebreak');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('singles', 'doubles');--> statement-breakpoint
CREATE TYPE "public"."entrant_status" AS ENUM('pending', 'active', 'withdrawn', 'noShow');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'ready', 'published', 'inProgress', 'complete', 'notRun');--> statement-breakpoint
CREATE TYPE "public"."format_kind" AS ENUM('singleElimination', 'roundRobin', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."match_outcome" AS ENUM('completed', 'walkover', 'retirement', 'default', 'unfinished');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'bye', 'live', 'complete');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'scorekeeper', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."round_kind" AS ENUM('main', 'thirdPlace');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('roundRobin', 'singleElimination', 'consolation');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."surface" AS ENUM('hard', 'clay', 'grass', 'carpet', 'other');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'published', 'inProgress', 'complete', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('draft', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"label" text,
	"rank" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "categories_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"surface" "surface" DEFAULT 'hard' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courts_tournament_name_unique" UNIQUE("tournament_id","name")
);
--> statement-breakpoint
CREATE TABLE "entrant_players" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"entrant_id" text NOT NULL,
	"player_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrant_players_unique" UNIQUE("entrant_id","player_id"),
	CONSTRAINT "entrant_players_position_unique" UNIQUE("entrant_id","position")
);
--> statement-breakpoint
CREATE TABLE "entrants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"seed" integer,
	"status" "entrant_status" DEFAULT 'pending' NOT NULL,
	"submission_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrants_event_seed_unique" UNIQUE("event_id","seed")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"category_id" text NOT NULL,
	"discipline" "discipline" NOT NULL,
	"format" "format_kind" NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"sets_to_win" integer DEFAULT 2 NOT NULL,
	"games_per_set" integer DEFAULT 6 NOT NULL,
	"tiebreak_at" integer DEFAULT 6,
	"tiebreak_to" integer DEFAULT 7 NOT NULL,
	"deciding_set_mode" text DEFAULT 'standard' NOT NULL,
	"ad_scoring" boolean DEFAULT true NOT NULL,
	"double_round_robin" boolean DEFAULT false NOT NULL,
	"group_count" integer,
	"qualifiers_per_group" integer,
	"third_place_playoff" boolean DEFAULT false NOT NULL,
	"min_entrants" integer DEFAULT 4 NOT NULL,
	"draw_random_seed" text,
	"manually_adjusted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_tournament_category_discipline_unique" UNIQUE("tournament_id","category_id","discipline")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"accent_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"club_affiliation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"venue" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"start_date" text,
	"end_date" text,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility" DEFAULT 'draft' NOT NULL,
	"entries_open" boolean DEFAULT false NOT NULL,
	"require_captcha" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_entrants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"group_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_entrants_unique" UNIQUE("group_id","entrant_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"adjustment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_stage_order_unique" UNIQUE("stage_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "match_sides" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"match_id" text NOT NULL,
	"position" integer NOT NULL,
	"entrant_id" text,
	"source_kind" text,
	"source_match_id" text,
	"source_group_id" text,
	"source_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_sides_position_unique" UNIQUE("match_id","position")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"event_id" text NOT NULL,
	"round_id" text NOT NULL,
	"group_id" text,
	"engine_match_id" text NOT NULL,
	"slot_index" integer NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"outcome" "match_outcome",
	"winner_entrant_id" text,
	"court_id" text,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_round_slot_unique" UNIQUE("round_id","slot_index")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"group_id" text,
	"round_index" integer NOT NULL,
	"name" text NOT NULL,
	"kind" "round_kind" DEFAULT 'main' NOT NULL,
	"idle_entrant_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"match_id" text NOT NULL,
	"actor_user_id" text,
	"actor_label" text,
	"client_event_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"reverted_by_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_events_client_id_unique" UNIQUE("match_id","client_event_id")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"match_id" text NOT NULL,
	"set_index" integer NOT NULL,
	"side0_games" integer NOT NULL,
	"side1_games" integer NOT NULL,
	"side0_tiebreak_points" integer,
	"side1_tiebreak_points" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sets_match_index_unique" UNIQUE("match_id","set_index")
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"event_id" text NOT NULL,
	"kind" "stage_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" text,
	"parent_stage_id" text,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stages_event_order_unique" UNIQUE("event_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"group_id" text NOT NULL,
	"entrant_id" text NOT NULL,
	"rank" integer NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"matches_won" integer DEFAULT 0 NOT NULL,
	"matches_lost" integer DEFAULT 0 NOT NULL,
	"sets_won" integer DEFAULT 0 NOT NULL,
	"sets_lost" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"tiebreak_trace" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standings_group_entrant_unique" UNIQUE("group_id","entrant_id")
);
--> statement-breakpoint
CREATE TABLE "entry_submissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"club_affiliation" text,
	"selections" jsonb NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"status_token" text NOT NULL,
	"matched_player_id" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"submitted_from_ip" text,
	"source_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_submissions_token_unique" UNIQUE("status_token")
);
--> statement-breakpoint
CREATE TABLE "grid_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"cells" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grid_templates_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "player_merges" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"canonical_player_id" text NOT NULL,
	"merged_player_id" text NOT NULL,
	"merged_snapshot" jsonb NOT NULL,
	"reassigned_entrant_ids" jsonb NOT NULL,
	"performed_by_user_id" text,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorekeeper_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text NOT NULL,
	"tournament_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_by_user_id" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorekeeper_tokens_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrant_players" ADD CONSTRAINT "entrant_players_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrant_players" ADD CONSTRAINT "entrant_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entrants" ADD CONSTRAINT "group_entrants_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entrants" ADD CONSTRAINT "group_entrants_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_entrant_id_entrants_id_fk" FOREIGN KEY ("winner_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_submissions" ADD CONSTRAINT "entry_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_submissions" ADD CONSTRAINT "entry_submissions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_submissions" ADD CONSTRAINT "entry_submissions_matched_player_id_players_id_fk" FOREIGN KEY ("matched_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_submissions" ADD CONSTRAINT "entry_submissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_templates" ADD CONSTRAINT "grid_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_merges" ADD CONSTRAINT "player_merges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_merges" ADD CONSTRAINT "player_merges_canonical_player_id_players_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_merges" ADD CONSTRAINT "player_merges_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorekeeper_tokens" ADD CONSTRAINT "scorekeeper_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorekeeper_tokens" ADD CONSTRAINT "scorekeeper_tokens_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorekeeper_tokens" ADD CONSTRAINT "scorekeeper_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_org_rank_idx" ON "categories" USING btree ("organization_id","rank");--> statement-breakpoint
CREATE INDEX "courts_tournament_idx" ON "courts" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "entrant_players_player_idx" ON "entrant_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "entrants_event_idx" ON "entrants" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "entrants_event_status_idx" ON "entrants" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "events_tournament_idx" ON "events" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "events_org_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "players_org_idx" ON "players" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "players_org_name_idx" ON "players" USING btree ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "players_org_email_idx" ON "players" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_slug_unique" ON "tournaments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tournaments_org_idx" ON "tournaments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "group_entrants_entrant_idx" ON "group_entrants" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "groups_stage_idx" ON "groups" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "match_sides_entrant_idx" ON "match_sides" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "matches_event_idx" ON "matches" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "matches_round_idx" ON "matches" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "matches_tournament_status_idx" ON "matches" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "matches_court_scheduled_idx" ON "matches" USING btree ("court_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "rounds_stage_idx" ON "rounds" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "rounds_group_idx" ON "rounds" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "score_events_match_idx" ON "score_events" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "stages_event_idx" ON "stages" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "stages_parent_idx" ON "stages" USING btree ("parent_stage_id");--> statement-breakpoint
CREATE INDEX "standings_group_rank_idx" ON "standings" USING btree ("group_id","rank");--> statement-breakpoint
CREATE INDEX "entry_submissions_tournament_status_idx" ON "entry_submissions" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE INDEX "entry_submissions_created_idx" ON "entry_submissions" USING btree ("tournament_id","created_at");--> statement-breakpoint
CREATE INDEX "entry_submissions_email_idx" ON "entry_submissions" USING btree ("tournament_id","email");--> statement-breakpoint
CREATE INDEX "player_merges_canonical_idx" ON "player_merges" USING btree ("canonical_player_id");--> statement-breakpoint
CREATE INDEX "scorekeeper_tokens_tournament_idx" ON "scorekeeper_tokens" USING btree ("tournament_id");