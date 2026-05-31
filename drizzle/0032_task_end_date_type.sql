UPDATE "tasks" SET "end_date" = NULL WHERE "end_date" = '';
ALTER TABLE "tasks" ALTER COLUMN "end_date" SET DATA TYPE date USING "end_date"::date;