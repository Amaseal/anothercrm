# CRM production library

The staff-only `/razosana` route (sidebar: **Production library** / **Ražošanas bibliotēka**) stores manufacturing products and their size labels in the CRM. It supports adding/deleting products, adding/deleting sizes and setting/unsetting one base size per product. English and Latvian are supported.

## Deploy

Apply the reviewed migration with the normal deployment process:

```sh
pnpm db:migrate
```

`drizzle/0037_melodic_iron_man.sql` adds only `production_products` and `production_sizes`. Product deletion cascades to its size labels. A partial unique index enforces at most one base size per product; size mutations lock the parent within a transaction so concurrent base changes serialize. Duplicate product names and size labels are rejected. Product names allow 120 characters, size labels 40; both are trimmed and control characters are rejected.

The migration was generated and inspected, **not applied to the configured database** during implementation. Deploying the route without the migration will fail when loading the library.

## Boundaries

- Every load and mutation explicitly requires an authenticated admin; clients cannot access the route and do not see its sidebar entry. SvelteKit's normal CSRF protection applies to form mutations.
- Production IDs are distinct from commercial product IDs and old standalone API IDs. The displayed `crm-production:<id>` reference matches the candidate workbook namespace.
- The CRM library starts empty. No old captures/products/sizes are imported and no standalone API is retired or changed. The plugin still uses its old backend; entries created there do not yet appear here.
- This route currently stores size **labels and base flags**, not native captures or previews. Capture storage/validation, parts, explicit commercial-product mappings and desktop authentication remain follow-ups in milestone 3. No production-library data is exposed to clients.
- Workbook persistence, task association and office/plugin roundtrip acceptance are still separate work. The roundtrip gate in `production-workbook-v1.md` has not been passed by adding this route.
- Deletion is explicit and requires confirmation in the enhanced browser UI. Later workbook/product mapping integration must revisit deletion constraints so referenced projects retain unresolved identities rather than silently remapping them.

## Verification

```sh
node scripts/verify-production-library.mjs
node scripts/verify-production-workbook.mjs
node scripts/verify-office.mjs
node scripts/verify-document-workflow.mjs
pnpm check
pnpm lint
pnpm build
```

The production-library self-check mocks all database access and exercises the real load/actions and production service. It checks unauthorized reads and every mutation, invalid IDs/text, duplicate handling, selection, parent locking, base replacement/unsetting, preventing a missing/foreign size from clearing the base, scoped deletion and safe database errors. It does not apply the migration or prove real PostgreSQL locking/constraints.

Implementation checks: production-library/workbook/office/document self-checks passed; `pnpm check` passed with zero errors/warnings; `pnpm build` passed with existing dependency circularity warnings. Targeted ESLint and Prettier checks passed. Repository-wide `pnpm lint` still reports the existing 591 errors and 1 warning outside this addition. The database migration and browser/Corel manual checks were not run.

Manual acceptance on a test database after migration:

1. As staff, open `/razosana`; add two products and sizes including `XL`, `07` and Latvian characters. Reload and verify persistence and product selection.
2. Set one base, then another; verify exactly one remains. Unset it and verify none remains. Repeat simultaneous changes from two tabs and confirm no duplicate bases.
3. Verify duplicate/empty/overlong input fails without losing entered fields; test a nonexistent product URL.
4. Cancel deletion and verify nothing changed; confirm size deletion, then product deletion with its size labels.
5. As a client and signed-out user, request the route and POST each action directly; verify rejection, not only sidebar hiding.
6. Check both languages and a narrow viewport. Ordinary products, tasks, attachments and old plugin behavior must remain unchanged.
