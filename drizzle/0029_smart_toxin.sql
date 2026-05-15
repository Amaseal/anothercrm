ALTER TABLE "invoice_items" ADD COLUMN "discount_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "discount_value" real DEFAULT 0 NOT NULL;