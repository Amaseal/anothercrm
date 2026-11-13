ALTER TABLE "files" ADD CONSTRAINT "files_id_task_id_unique" UNIQUE("id","task_id");
--> statement-breakpoint
CREATE TABLE "production_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	CONSTRAINT "production_projects_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
ALTER TABLE "production_projects" ADD CONSTRAINT "production_projects_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_projects" ADD CONSTRAINT "production_projects_file_task_fk" FOREIGN KEY ("file_id","task_id") REFERENCES "public"."files"("id","task_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_projects_task_id_idx" ON "production_projects" USING btree ("task_id");