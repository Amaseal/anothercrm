# Production list generation

The task-page workflow is **select source → Generate → preview modal with Edit**. The source chooser is always visible. There is no Preview gate, consent checkbox, approval checkbox, filename/product setup form or separate Save step.

## User workflow

1. Select a file, one task attachment, task-description text, or one saved editor image from the source selector. Text/screenshot paste is also supported. Saved editor images must already be in the saved description; paste a newly added screenshot directly if the task is not saved yet.
2. Click **Generate**. Source inspection happens automatically (free). Standard tables are recognized and parsed locally; other supported inputs use Gemini, with a short paid/data-sharing notice beside the button. The click is the explicit paid-call authorization—selecting/pasting/reading a source never calls Gemini. One visible worksheet is used for XLSX, with an optional sheet selector for multi-sheet files.
3. The result is automatically saved as a **new draft** and opens immediately in a preview modal with **Edit**. Long lists scroll inside the bounded dialog; the Edit button stays visible in its footer. The task page keeps compact file cards, and their Preview actions reopen the same modal. Edit opens that saved workbook in the existing office suite; CRM Save there persists corrections. Returning from Edit refreshes the displayed rows automatically. No office iframe, fonts or WASM load just to generate/view the list.

There is no automatic order approval or production execution. Existing workbooks and customer originals are never replaced/moved. Every successful Generate creates a separate file/project identity, even if its filename is `production.xlsx` again.

Product selection is not a prerequisite for generating a list. A generated workbook has `Setup.Draft = true`, an empty default production product unless one was explicitly provided through the API, and the usual packing defaults (1600 mm roll, 1500×1000 mm sheet, 5 mm gap, 2 mm profile). Missing sizes, missing artwork and unresolved source product text are preserved with warnings so Edit can correct them. No product is guessed or matched by title. Full size/product/artwork/settings resolution remains mandatory before actual Corel preparation/generation; see [production-workbook-v1.md](production-workbook-v1.md).

If parsing fails, the selected source and existing results remain. If saving fails after parsing, the proposal stays visible with Edit; **Finish saving result** retries only storage, not the paid AI request. A lost save response is ambiguous: refresh the saved list before retrying. Cancellation is best-effort and a started/timed-out AI request may still be billed. Only abandoning an in-progress operation/unsaved failed-save proposal prompts a navigation warning; successful generation needs no confirmation dialog.

## Configuration

Edit the shared key/model in **Settings → Gemini settings** (`/iestatijumi#gemini`). Model discovery and saving configuration make no paid generation requests. Legacy `GEMINI_API_KEY` / `GEMINI_MODEL` are used only before the first Settings save; database values then take precedence, including explicit removal. Keys are server-only DB text, not application-encrypted; restrict DB and backup access. See [gemini-settings.md](gemini-settings.md).

Source and configuration revisions are still checked before billing. If either changed, the request fails without a paid call, the chooser refreshes automatically, and the user can check the current selection/model and click Generate again. There is no automatic paid fallback/retry after an error.

Existing migrations `0037`–`0039` are required and were not applied during implementation. The simplified flow/draft marker needs no additional database migration. SheetJS remains pinned to its official `0.20.3` CDN release with lockfile integrity, replacing vulnerable `0.18.5`; clean installs need `cdn.sheetjs.com` access. Invoice/legacy imports share this dependency and still need manual verification.

## Supported input and safety

- PDF, PNG/JPEG, UTF-8 TXT/CSV/TSV and simple XLSX. DOC/DOCX, other image formats, remote URLs and Corel/design files are not supported; paste/export the relevant content instead.
- Source file limit: 8 MiB; text: 128,000 characters; selected XLSX sheet: 10,000 rows/20 columns plus shared ZIP expansion limits. Formulas, macros, objects/media and external links/entities are rejected. Some customer XLSX files with logos need a PDF/image/text excerpt.
- CSV/TSV local headers: `Name, Size, Number[, Artwork, Product]` (case-insensitive). Unicode, row order, blank optional values and leading-zero numbers survive. Different layouts are clearly identified as paid AI input before Generate is enabled; no paid fallback runs without another explicit click.
- Only attachment IDs belonging to the current authorized task and one explicitly selected saved editor image are resolved server-side. Arbitrary URLs/nested/unsafe paths are never fetched. Upload/paste sources stay in memory, not in the ordinary attachment list. Source inspection is automatic but never submits all editor images, worksheets or attachments.
- The entire selected PDF/image goes inline to Google only on Generate. The byte limit is not a page/token/billing cap: split large PDFs and configure Google quotas/budgets before production use. Review Google data-handling terms and customer authorization; provider retention/training policies are outside CRM control.
- Gemini: one request, 60-second timeout, 8192 output tokens, 2 MiB streamed response limit. Only complete `STOP` responses and correctly typed strings/null fields are accepted; numeric JSON Number fields, blocked/partial output and malformed rows fail. No automatic paid tests, retries or continuations.
- Draft persistence still validates file format/version, fixed sheets/headers, text cells/numbers, packing settings, ZIP/row/cell limits and task authorization. `Draft=true` permits incomplete production data for correction; it does not bypass file/security validation. No credentials, source images, native captures or Corel session state enter the workbook.

## Shared API

All routes require the existing staff CRM session; clients remain forbidden. No desktop/shared-key authentication or standalone-plugin cutover is introduced.

Base: `/api/tasks/{taskId}/production-parse`

- GET: eligible source choices and public AI status (never the key).
- POST `/source`: selected multipart source (`kind=text|file|attachment|editor-image`, appropriate text/file/ID/index and optional sheet). Returns the prepared source, SHA-256 revision, worksheet choices and detected `engine=local|ai`. This is automatic free inspection; no provider call/storage write.
- POST base: source fields, `sourceRevision`, detected `engine`; AI additionally needs `paidConsent=true` and current `aiRevision`. Generate supplies these as part of its disclosed direct action. Returns normalized rows/warnings/source identity; nothing stored yet.
- POST `/save`: JSON `{ orders }` creates a new draft automatically and returns file/project identity plus the normalized **saved** workbook for immediate preview. Optional `defaultProductId`/`filename` remain API inputs; UI requires neither. No `reviewed` flag or separate human approval is needed. Task association is authoritative from the URL, never an embedded source ID.

The UI chains these requests behind the single Generate action and retains parsed rows across save failures. The old standalone API remains unchanged. Desktop auth, native captures, product mappings and full plugin Open/Save are still separate work.

## Verification

```sh
node scripts/verify-gemini-settings.mjs
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

Self-checks mock Gemini/database operations and use unique temporary files. Parsing checks cover automatic free table recognition, scoped source selection, explicit paid requests, source/config revision protection, cancellation, leading zeros/Unicode, strict model output, draft creation without review/product/filename gates, preservation of incomplete values and non-destructive repeated generation. Draft tests reject formulas and invalid markers and retain strict validation for non-draft workbooks. They never make real paid calls or mutate customer records.

Interactive browser/Google/office/Corel acceptance remains pending: verify source selection → one Generate click → automatic scrollable modal → Edit, plus save failures/cancellation, multi-sheet sources, refreshed edits and required production resolution before Corel generation. The operator requested no further testing before completion; modal browser checks and the full regression suite for the latest simplification were not run. The existing office/plugin roundtrip and real database checks remain required before cutover.
