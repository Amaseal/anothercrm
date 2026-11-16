CREATE TABLE "print_tools_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "print_tools_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "production_captures" (
	"id" serial PRIMARY KEY NOT NULL,
	"size_id" integer NOT NULL,
	"payload" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_captures_size_id_unique" UNIQUE("size_id")
);
--> statement-breakpoint
CREATE TABLE "production_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	CONSTRAINT "production_parts_product_id_name_unique" UNIQUE("product_id","name"),
	CONSTRAINT "production_parts_name_valid" CHECK (length(btrim("production_parts"."name")) between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "print_tools_tokens" ADD CONSTRAINT "print_tools_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_captures" ADD CONSTRAINT "production_captures_size_id_production_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."production_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_parts" ADD CONSTRAINT "production_parts_product_id_production_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."production_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "production_parts_one_base_idx" ON "production_parts" USING btree ("product_id") WHERE "production_parts"."is_base";