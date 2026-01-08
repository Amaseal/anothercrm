CREATE TYPE "public"."client_type" AS ENUM('BTC', 'BTB');--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "type" TYPE client_type USING type::client_type;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "type" SET DEFAULT 'BTC'::client_type;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "email_or_phone_required" CHECK ("clients"."email" IS NOT NULL OR "clients"."phone" IS NOT NULL);