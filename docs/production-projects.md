# Task production workbooks

Status: CRM storage/API and staff-only task field implemented. [Source parsing and draft generation](production-parsing.md) now populate this field from the CRM UI; the plugin workflow remains incomplete. Office/plugin roundtrip acceptance in `production-workbook-v1.md` is still pending; do not cut over the plugin or treat the contract as approved for production yet.

## Deploy and storage

Review/apply `drizzle/0038_lucky_iron_monger.sql` through the normal migration process (`pnpm db:migrate`). It adds `production_projects` and a supporting unique constraint on `(files.id, files.task_id)`. Review corrected the generated statement ordering so the supporting unique constraint exists before its composite foreign key. Each reference has a unique file ID and composite foreign key enforcing that the file belongs to the same task. Task/file deletion is restricted while a production reference exists.

The migration was generated and inspected, **not applied to the configured database** during implementation.

Files use the existing `uploads` volume, under the private `uploads/production/` directory with random stored names. File records continue to own filenames, paths, sizes and timestamps; garment rows are not stored in the database. Ordinary uploads, even named `production.xlsx`, do not create a production-project reference.

Back up **the entire uploads volume, including `production/` and `.previous` copies, together with matching database metadata**. Restore them as a consistent set. Creation removes its new file on transaction failure; a process crash before commit can leave an unreferenced private file, which needs reconciliation during restore/maintenance. No orphan collector or general history UI was added.

## Task field

Active-task view/edit and completed-task detail pages show a separate **Production table** section to staff. It has no upload/add-files/drop-zone controls and does not submit an attachment list. Referenced production files are excluded from the ordinary task attachment list and attachment synchronization.

Saved files use compact attachment cards with **Preview**, **Edit** and **Download**. Preview opens a bounded, scrollable modal with Edit fixed in the footer; generation opens this modal automatically. Preview uses the normalized server workbook reader, not the office suite or a second database copy. It shows garment count, warnings and a paged read-only preview (100 rows per page, with all rows available). Parsed proposals and saved workbooks reuse the same table. The office suite is only opened by Edit, in a new tab to preserve unsaved task fields.

Refresh and returning focus to the task check saved revisions. A changed revision automatically reloads the currently displayed preview; an unverifiable revision clears it rather than presenting stale data as current. There is no live synchronization; plugin saves while the task stays focused require Refresh. Merely viewing the section loads no office iframe, fonts or WASM.

The separate **Generate size list** chooser now uses **select source → Generate → preview modal with Edit**. Source inspection is automatic/free, standard tables parse locally, and Generate is the disclosed paid authorization for AI inputs. A successful action saves a separate `Draft=true` workbook automatically; there are no approval checkboxes, product/filename gates or separate Save step. See `production-parsing.md` for configuration, file limits and the workflow. Plugin Save/Save As is not connected yet. There is deliberately no general attachment-upload shortcut into this field.

## API

All endpoints currently use the existing CRM **staff session**. Clients, even owners, cannot read/write these workbooks because snapshots may contain staff-only context. Office access remains staff-only. Desktop tokens/client policy are deferred to the authentication milestone; the old shared plugin API key is not accepted here.

Task IDs, project IDs and file IDs are distinct. Endpoints always resolve a production reference within the URL task; embedded workbook TaskReference values grant no access and cannot reassign the file.

Base: `/api/tasks/{taskId}/production-projects`

| Method / path                | Behavior                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET base                     | List project ID, file ID, display filename, actual byte size and SHA-256 revision                                                                               |
| POST base                    | Explicit project Create/Save As; multipart `file` containing a contract-valid XLSX; returns new identity (201)                                                  |
| GET `/{projectId}`           | Normalized read-only workbook preview and its saved revision                                                                                                    |
| GET `/{projectId}?download`  | Authorized original workbook bytes; `X-Document-Revision` header                                                                                                |
| POST `/{projectId}`          | Save existing identity; multipart `file` and opened `revision`; stale saves return 409                                                                          |
| GET `/{projectId}/previous`  | Download the previous successful copy (404 before the first save)                                                                                               |
| POST `/{projectId}/previous` | Explicit recovery; multipart current `revision`; restores the previous copy using the same validated save path and keeps the replaced current copy for recovery |

Create/Save As accepts a validated project file, not a generic upload designation request. Duplicate filenames create distinct IDs. The XLSX TaskReference snapshot is informational only.

## Save safety and validation

`src/lib/server/documents.ts` now owns the shared write path used by office Save and production Save/recovery. Revisions are SHA-256 of the actual bytes, strengthening the old modification-time/size check for **both** editors. Open/download reads the same bytes used to calculate the revision.

Saves validate production input before modification, acquire the existing short per-file `.lock`, recheck revision, flush a unique temporary file, flush the prior current bytes to a rollback copy, atomically replace the file, update file metadata and only then promote the rollback copy to `.previous`. Failed saves leave the existing previous successful copy unchanged. Metadata-update failure attempts atomic restoration of the original bytes. If restoration also fails, the rollback file is retained and the server logs its recovery location. A crash can leave a lock/temporary file; remove a lock only after confirming no save is active. Filesystem/database writes cannot be one atomic transaction across process crashes; use the recovery copy/backups and reconcile metadata on restore.

`src/lib/server/production-workbook.ts` checks both sheets, fixed headers, text numbers, packing settings, version and product/artwork rules. Non-draft files still require sizes and stable references; marked `Draft=true` proposals may preserve missing sizes/default products/artwork and unresolved source Product text with warnings for Edit/Print Tools correction. Unsupported sheets, merges, formulas, hyperlinks, external relationships/entities, macros, images and embedded objects are rejected rather than rewritten away. Missing product-name snapshots produce warnings and preserve the original reference; catalog resolution and generation still need the plugin/configuration work.

Limits: 25 MiB compressed upload, at most 1,000 ZIP entries, 16 MiB per expanded entry, 64 MiB total expanded data, 10,000 order rows, 1,000 Setup rows and 1,000 characters per cell. Actual ZIP expansion is streamed and bounded before SheetJS reads it. No formulas/macros are executed. Saves persist the submitted bytes, not a lossy reconstructed workbook.

The public uploads route, ordinary ZIP downloader and filesystem document aliases cannot access the private directory. Ordinary file-removal routes and the Files manager cannot remove its files or backups; the manager excludes production entries. These checks also cover normalized paths into that directory.

## Completion and deletion

Completion retains production files, their metadata, references and previous copies. Ordinary attachments/previews retain their existing completion-cleanup behavior. Attachment synchronization only deletes ordinary files.

Task deletion is explicitly blocked (409) while it has production projects, on both active and completed deletion paths. There is **no production-project deletion API/UI yet**; implementing a deliberate deletion policy is a separate operation, not incidental task cleanup. A task-row lock serializes active task deletion against project creation, and database foreign keys enforce retention independently.

Touched task view/edit/completion/deletion routes now check task access directly before querying/mutating: staff, creator, assignee or linked client, matching existing task-list visibility rules. This does not grant clients workbook access.

## Verification

```sh
node scripts/verify-production-parsing.mjs
node scripts/verify-production-projects.mjs
node scripts/verify-production-workbook.mjs
node scripts/verify-production-library.mjs
node scripts/verify-office.mjs
node scripts/verify-document-workflow.mjs
pnpm check
pnpm lint
pnpm build
```

The project self-check uses unique temporary files and mocked database operations. It tests malformed/unsupported/bomb XLSX input, text numbers, direct authorization, cross-task identities, creation rollback, ordinary-upload non-designation, private paths, removal guards, office/API shared saves, stale revisions, write locks, metadata-failure rollback, previous-copy download/recovery, same-size/same-mtime revision changes and completion retention. It does not prove real PostgreSQL constraints/locking or the interactive editor/plugin roundtrip.

Implementation results: all five self-checks passed; `pnpm check` reported zero errors/warnings; `pnpm build` passed with existing dependency circularity warnings. New modules/API/component and the shared document code passed targeted ESLint/Prettier. Repository-wide `pnpm lint` remains blocked by 589 errors and 1 warning in legacy code. Migrations and interactive browser/Corel acceptance were not run.

Pending manual acceptance on a test database after migration:

1. Create a project through the authenticated API using the synthetic fixture; confirm it appears only in Production table, including after task edits and reloads. Confirm an ordinary upload with the same filename stays an ordinary attachment.
2. Preview without opening the office suite; inspect network activity. Use Edit → CRM Save → return to task → refresh preview; check current revision and leading-zero numbers.
3. Save stale copies from two tabs/API callers; verify 409 without loss of the newer bytes or unsaved editor changes. Download the previous copy and test explicit recovery.
4. Complete a test task; verify current/previous production files remain and ordinary cleanup still runs. Try active/completed task deletion and ordinary file-removal endpoints; verify rejection before production data loss.
5. Exercise task access as staff, creator, assignee, linked client and unrelated client. All workbook endpoints remain staff-only, including when raw URLs/file IDs are known.
6. Verify backup/database restore, real PostgreSQL constraints, concurrent create/delete/base operations and the full office/plugin roundtrip gate. No paid AI calls or live customer records are needed.
