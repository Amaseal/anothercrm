CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration_number" text NOT NULL,
	"vat_number" text NOT NULL,
	"address" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_code" text NOT NULL,
	"bank_account" text NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"logo" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"document_type" text DEFAULT 'invoice' NOT NULL,
	"task_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"company_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"payment_term_days" integer DEFAULT 7,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_rate" real DEFAULT 21,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"total_in_words" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"is_electronic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_company_settings_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_settings"("id") ON DELETE no action ON UPDATE no action;