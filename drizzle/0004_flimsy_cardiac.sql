CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"article" text NOT NULL,
	"image" text,
	"manufacturer" text,
	"gsm" text,
	"width" text,
	"remaining" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
