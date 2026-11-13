CREATE TABLE "gemini_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	CONSTRAINT "gemini_settings_singleton" CHECK ("gemini_settings"."id" = 1)
);
