-- 1. Change the column type from text to integer
ALTER TABLE "materials" ALTER COLUMN "id" TYPE integer USING "id"::integer;

-- 2. Create a sequence for autoincrement if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS materials_id_seq;

-- 3. Set the default value of the id column to use the sequence
ALTER TABLE "materials" ALTER COLUMN "id" SET DEFAULT nextval('materials_id_seq');

-- 4. Set the sequence to the max value of your current IDs (or 1 if table is empty)
SELECT setval('materials_id_seq', COALESCE((SELECT MAX(id) FROM "materials"), 1));

-- 5. (Optional) Set NOT NULL and PRIMARY KEY if needed
ALTER TABLE "materials" ALTER COLUMN "id" SET NOT NULL;
-- ALTER TABLE "materials" ADD PRIMARY KEY ("id"); -- Uncomment if needed