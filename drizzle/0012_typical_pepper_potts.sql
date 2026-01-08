CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"download_url" text NOT NULL,
	"size" integer NOT NULL,
	"task_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "manager_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "seamstress" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "count" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "end_date" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_printed" boolean;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "preview" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "status";