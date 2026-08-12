-- Functional indexes to support diacritic-normalized search.
-- ilikeNormalize() applies translate(lower(col), 'āčēģīķļņšūž', 'acegiklnsuz').
-- PostgreSQL can only use an index when the query expression exactly matches the index expression.

CREATE INDEX IF NOT EXISTS "material_title_normalized_idx"    ON "material"  (translate(lower("title"),          'āčēģīķļņšūž', 'acegiklnsuz'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_article_normalized_idx"  ON "material"  (translate(lower("article"),        'āčēģīķļņšūž', 'acegiklnsuz'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "material_mfr_normalized_idx"      ON "material"  (translate(lower("manufacturer"),   'āčēģīķļņšūž', 'acegiklnsuz'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_name_normalized_idx"       ON "clients"   (translate(lower("name"),           'āčēģīķļņšūž', 'acegiklnsuz'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_title_normalized_idx"        ON "tasks"     (translate(lower("title"),          'āčēģīķļņšūž', 'acegiklnsuz'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_number_normalized_idx"    ON "invoices"  (translate(lower("invoice_number"), 'āčēģīķļņšūž', 'acegiklnsuz'));
