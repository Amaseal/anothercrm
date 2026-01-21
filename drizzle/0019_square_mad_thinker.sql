ALTER TABLE "clients" ADD COLUMN "vat_rate" real DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "language" text DEFAULT 'lv' NOT NULL;