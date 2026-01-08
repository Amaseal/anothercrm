ALTER TABLE "invite_codes" ADD COLUMN "type" "user_role" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "type" "user_role" DEFAULT 'client' NOT NULL;