CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_task_id_idx" ON "invoices" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_client_id_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tasks_is_done_idx" ON "tasks" USING btree ("is_done");--> statement-breakpoint
CREATE INDEX "tasks_tab_id_idx" ON "tasks" USING btree ("tab_id");--> statement-breakpoint
CREATE INDEX "tasks_end_date_idx" ON "tasks" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees" USING btree ("task_id");