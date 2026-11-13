CREATE TABLE "production_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "production_products_name_unique" UNIQUE("name"),
	CONSTRAINT "production_products_name_valid" CHECK (length(btrim("production_products"."name")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "production_sizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"label" text NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	CONSTRAINT "production_sizes_product_id_label_unique" UNIQUE("product_id","label"),
	CONSTRAINT "production_sizes_label_valid" CHECK (length(btrim("production_sizes"."label")) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "production_sizes" ADD CONSTRAINT "production_sizes_product_id_production_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."production_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "production_sizes_one_base_idx" ON "production_sizes" USING btree ("product_id") WHERE "production_sizes"."is_base";