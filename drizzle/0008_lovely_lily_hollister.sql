CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"description" text,
	"address" text,
	"vat_number" text,
	"registration_number" text,
	"bank_name" text,
	"bank_code" text,
	"bank_account" text,
	"type" text DEFAULT 'BTC' NOT NULL,
	"total_ordered" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
