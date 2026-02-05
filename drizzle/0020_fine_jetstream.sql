ALTER TABLE "tasks" RENAME COLUMN "manager_id" TO "created_by_id";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_manager_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;