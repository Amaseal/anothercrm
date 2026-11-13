# Print Tools + CRM integration plan

Status: milestone 1 started. The candidate [v1 workbook contract](production-workbook-v1.md), synthetic fixture and offline roundtrip checker are implemented. A staff-only [CRM production library](production-library.md) at `/razosana` now implements the products/size-label/base-flag portion of milestone 3, independently requested alongside the persistence plan. Its database migration must be applied before use. The [task workbook foundation](production-projects.md) now adds staff-only durable storage/APIs, the dedicated task field, previews, shared safe saves, recovery and completion retention. Required migrations must be applied before use. [CRM list generation](production-parsing.md) now uses the operator-requested **select source → Generate → preview modal with Edit** flow. Inspection is automatic/free; Generate discloses/authorizes paid AI when needed and automatically saves a separate `Draft=true` proposal. Preview/approval checkboxes, product/filename gates and separate Save actions are removed. [Editable Gemini settings](gemini-settings.md) now provide a staff-only shared key/model form and dynamic model discovery, with env fallback only before the first Save. Configuration changes invalidate old paid consent. Office/plugin roundtrip acceptance, desktop authentication and plugin cutover remain pending.

## Goal and agreed direction

Use the CRM as the single backend for Print Tools. A saved Print Tools project is an XLSX workbook attached to a CRM task. The CRM's embedded office suite and the CorelDRAW plugin can both open, edit and save that workbook.

The team is small, users generally work on their own projects, and concurrent editing is rare. Reuse existing document storage and save safeguards; do not build collaborative editing infrastructure.

- CRM owns tasks, access control, project files, products, materials, seamstress details and AI services.
- The workbook owns the saved production rows and plugin production setup.
- Print Tools owns Corel operations: native capture, Prepare, personalization, packing and local checks.
- Corel documents own artwork and generated objects. They are not part of this persistence feature.
- The standalone Print Tools API is retired once the CRM covers its functions.
- Existing captured sizes do not need migration. They can be recaptured against the CRM backend.

## User workflow

1. Create or open a CRM task and select its products, materials and seamstress.
2. Provide the customer's size list as an attachment, text or an image pasted into the task's WYSIWYG editor, or pasted chat-style content such as a WhatsApp message/screenshot. Uploading a separate file is not required. Design files remain ordinary attachments and are not processed by this integration.
3. Select the source in the dedicated chooser and click **Generate**. Free source inspection is automatic; paid AI use is disclosed beside Generate and authorized by that click. Save a separate normalized draft workbook, for example `production.xlsx`, automatically into **Production table**, never into ordinary attachments or over an existing workbook. No preview gate, acceptance checkbox, product/filename setup or separate Save click is required.
4. Present the saved workbook using the same file-row/card styling as ordinary attachments, but in the separate Production table field with its lightweight read-only table preview and **Edit** button. Only clicking Edit opens the workbook in the embedded office suite; use CRM Save there to persist corrections. Do not load the expensive office editor just to view a list.
5. In Print Tools, select an accessible task and its production workbook, then open it into the order grid and production settings.
6. Edit in the plugin and Save back to the same CRM file, or Save As a new project workbook. Plugin-to-CRM write support is part of the MVP, not a later feature.
7. Prepare Sizes in the current Corel document, inspect the masters, then Generate.
8. Close and reopen the saved workbook later, or download it for reuse. Reopening restores data/settings, not the Corel preparation session.

An original customer attachment and a production workbook are separate files. Parsing must never silently replace a reviewed workbook. AI output is a proposal, not an automatically approved order.

### Dedicated Production table field

- Place parsed/generated workbooks in their own task field/section, visually consistent with the existing file list but clearly separate from regular attachments.
- Reuse file-row/card presentation and relevant preview, Edit and Download actions. The field has no Add files button, file picker, upload drop zone or clipboard-file attachment behavior.
- Populate it through explicit size-list generation or the plugin's project Save/Save As flow. Selecting an existing attachment as a parsing source does not move that original into this field.
- The source chooser may still accept uploads/pasted text/images as described below; that is parsing input, not an upload control on the Production table field.
- Plugin saves and office edits update the same designated workbook entry, never create duplicate regular attachments. Save As creates a distinct designated project workbook.
- Ordinary attachment uploads cannot become production tables merely because their filename is `production.xlsx`. Use server-controlled designation and validate the workbook contract on production save/create.
- Download/reuse remains supported. If importing a previously downloaded project is offered, make it an explicit validated plugin project-open/import operation, not a general CRM attachment-upload control in this field.

## Existing building blocks

See `docs/office-editor.md` for the current embedded office implementation.

- `/dokumenti` already supports XLSX creation, upload, editing, saving and downloading.
- Existing project attachments can be opened by database file ID; saves update their metadata.
- `src/lib/server/documents.ts` loads documents, validates formats and exposes a SHA-256 revision of the actual bytes (strengthened from the earlier modification-time/size revision during task-workbook implementation).
- The document workflow already provides temporary-file writes, atomic replacement, revision rejection and a per-file write lock. Reuse these safeguards rather than add a separate plugin storage implementation.
- The editor integration is currently staff-only. It must not be assumed to provide owner-scoped client access.
- Task completion in `src/routes/(app)/projekti/pabeigt/[id]/+page.server.ts` now retains designated production workbooks while preserving ordinary attachment cleanup. Task deletion is blocked while production projects exist.

These are source-level observations, not verification of the deployed editor or its workbook roundtrip behavior.

## Workbook contract: version 1

Define and document one explicit workbook format before implementing both readers/writers. XLSX is the portable project format, not merely an export from database garment rows.

### Orders sheet

Use fixed, documented headers compatible with the current order model:

| Name  | Size | Number | Artwork | Product |
| ----- | ---- | ------ | ------- | ------- |
| OZOLS | L    | 07     | Home    | Jersey  |

- One row represents one physical garment. Names and numbers can be blank; size is required before actual production. Generated `Draft=true` proposals can preserve missing sizes/unresolved products for correction in Edit.
- Number values are text so leading zeros survive CRM editing, download and plugin roundtrips.
- Preserve row order, Unicode, blank optional values and valid existing product/artwork rules.
- Use stable product identifiers in a documented mapping within the workbook; display names alone must not determine catalog identity. Preserve unresolved references for correction rather than silently choosing another product.
- Artwork references name groups in the current Corel document. Opening a file cannot guarantee those groups exist; validate during preparation.
- Read a defined value range and ignore wholly empty trailing rows. Reject formulas in production input fields for the MVP; do not rely on stale cached Excel formula results.

### Setup sheet

Use a small visible key/value sheet so the embedded editor does not need to preserve custom XLSX metadata to retain required settings.

Include:

- Workbook format version.
- Relevant plugin setup: usable roll width, sheet width/height, gap and packing profile resolution.
- Selected default production product and any explicit material-slot assignments needed to reproduce setup.
- Optional task reference and a snapshot of task context useful after downloading, such as project title and seamstress.

Define the exact field list by inspecting current plugin controls and defaults. Do not persist API credentials, session tokens, image payloads, native size captures, COM references or prepared-session state in the workbook.

CRM task association is authoritative for access and ownership. A task ID embedded in an uploaded workbook must not grant access or automatically reassign the file. When connected, show current CRM context; clearly distinguish any older workbook snapshot.

### Roundtrip rules

- Verify that the embedded office suite preserves both sheets, text numbers and all required values.
- Both save paths must preserve the supported project fields. A plugin save must not silently discard unrelated sheets or user content: preserve them with the chosen XLSX tooling, or reject unsupported workbook structures before overwrite.
- Invalid headers, unsupported versions, malformed XLSX and invalid packing settings fail without changing the stored file. Only marked `Draft=true` proposals may preserve incomplete production fields with warnings for correction; non-drafts retain strict validation and actual production always requires full resolution.
- Apply existing upload limits plus bounded XLSX expansion/row limits. Never execute workbook formulas or macros.
- Reuse suitable installed libraries; choose the smallest maintained XLSX tooling where a project has none. Do not build a generic spreadsheet engine.

## Minimal database and storage changes

Reuse existing physical file storage and file-record mechanisms, with an explicit production-workbook designation/relation for the dedicated task field. Do not add one database record per garment or duplicate workbook content into a second authoritative table.

Store the production-workbook reference explicitly in the database, separately from the ordinary attachment list. For the planned support of multiple saved projects per task, use a small `production_projects` relation with its own ID, a task foreign key and a unique file foreign key referencing the existing file record. Reuse existing file metadata for filename, timestamps and revision handling rather than duplicating paths or workbook content. This is one reference record per saved project, not one record per garment.

The plugin can fetch a task's production projects directly through this relation; return project ID, file ID, display filename and current revision, then download the authorized workbook by stable identity. Do not scan attachments or infer project identity from filenames. Filter referenced production files out of the regular attachment list so the two fields cannot be confused. A task may hold multiple named project workbooks within its Production table section; Open selects one explicitly and Save updates that file. Save As creates a distinct file record and production-project reference.

Create/update the file metadata and project reference consistently. Verify that the referenced file belongs to the same task, enforce task permissions through the reference, and prevent ordinary attachment removal or completion cleanup from deleting a referenced production file. Reuse existing document download/save services behind these authorization checks.

- Reuse existing task/client ownership and staff access policies; verify them server-side on every list/open/save/download action.
- Preserve production workbooks when a task is completed. Keep existing cleanup behavior for other attachment categories unless deliberately changed.
- Retain one previous successful workbook revision for recovery, without introducing a general version-history UI in the MVP.
- Backups must include upload files and matching database metadata. File-only storage is not durable if container replacement or task cleanup removes it.
- Define explicit deletion behavior separately from task completion; do not silently delete a saved project as incidental cleanup.

## CRM backend consolidation

Move the existing Print Tools API responsibilities into a clearly scoped CRM production module, served by the existing SvelteKit application:

1. Production product configuration: parts, size labels, base flags and captured native formations.
2. Gemini settings, model discovery/validation and shared order parsing.
3. Task/project listing and production-workbook open/create/save/download.
4. Existing visual-review requests, if that plugin feature is retained.

Inventory the actual standalone API routes before cutover; do not retire it while a plugin feature still depends on it. Preserve explicit paid-call consent, validation, cancellation semantics and protection of provider secrets. No paid model tests are needed merely to implement the move.

Link CRM products to optional production configuration. Commercial products and manufacturing templates are distinct concepts within one backend: not every service needs captured sizes, and commercial variants may share a template. Do not equate independent numeric product IDs or match by title silently.

Fresh recapture removes the need to import old captured data. Preserve current native OLE envelope validation and PasteEx behavior; consolidating the backend is not a reason to change Corel clipboard/loading code.

### Authentication

Provide desktop-suitable, revocable authentication with user identity and task-scoped authorization. Decide the smallest suitable sign-in/token flow before implementation; do not reuse the old shared hardcoded API key as the long-term CRM credential.

The external client must only access permitted tasks/files. Existing staff-only office access should remain unchanged unless client editing is explicitly approved. Sharing a backend must not expose staff-only seamstress details, AI configuration, other clients' projects or production-library write access.

## Shared parsing and source selection

Expose one CRM parsing service usable from the CRM UI and the plugin's existing text/image/file input controls. CRM source input must have the same practical flexibility as the plugin, not require a file upload first.

### Select the source before generating the list

Offer an explicit source chooser for:

- An existing task attachment or newly uploaded size-table file/image.
- Text from the task's WYSIWYG editor, including pasted lists or chat messages.
- An image pasted into the WYSIWYG editor, selected explicitly when the editor contains several images.
- Directly pasted text or a screenshot in the parsing input, including WhatsApp-style copied content. This means paste support, not a WhatsApp account/API integration.

Inspect the chosen source automatically without a required Preview click; show its identity/image and an optional text/PDF preview so the user can inspect exactly what Generate will submit. Let the user choose the relevant editor text/image or paste an excerpt rather than submitting the entire task description and unrelated design images. For mixed text and images, make the chosen source clear; never silently submit every image or attachment.

- Reuse current local/structured parsing where possible; do not make a paid AI call for a normal CSV/TSV import.
- Normalize results into the same order model used to create the workbook.
- Generate is the explicit paid action, with a brief model/data-sharing/cost notice. It saves a new draft automatically, not an approved order; selecting/pasting a source never triggers a paid request. Do not reintroduce consent/review checkboxes or a separate Save gate.
- Keep customer originals and WYSIWYG content untouched. Optionally record the source attachment/editor reference as metadata; do not require every pasted source to become a separate uploaded file.
- Enforce task/file permissions and text/image/file limits for every source. Resolve authorized local editor images safely; do not fetch arbitrary pasted URLs server-side.
- Parsing failure must not overwrite an existing project or clear the selected source, an existing preview or unsaved plugin edits.

### Preview first, office editing on demand

After Generate, automatically persist a new `Draft=true` proposal and open its rows/count/warnings in a bounded, scrollable modal with **Edit** fixed in the footer. Saved-file Preview uses the same modal and task-page cards remain compact. Keep incomplete sizes/default products and unresolved source product values for correction instead of forcing extra mapping/approval steps. Drafts still enforce safe XLSX structure/text numbers/settings, and all production requirements must resolve before Corel Prepare/Generate. Existing workbooks are never replaced by this action; only clicking Edit loads the office suite.

For a saved project, display a lightweight preview of the current workbook and an **Edit** button. Viewing a task or generating a list must not initialize the office suite, its iframe, fonts or WASM. Load it only on explicit Edit.

Render the preview from the same normalized workbook reader used by the integration, not a second authoritative copy of garment rows in the database. Any preview cache must be keyed by file identity and revision. Refresh it after office or plugin saves; never present an older preview as the latest saved workbook. Identify an unsaved parsed preview as a draft.

This is a read-only table, not a custom spreadsheet editor. Corrections use the existing office suite or the plugin grid.

## Open, Save and rare conflicts

Use the existing document revision/write safeguards for both editors.

- Open returns the file identity, bytes and revision.
- Save submits the opened revision. The server verifies permission and revision, validates the workbook, and safely replaces the file while retaining the previous successful copy.
- A stale save does not overwrite the newer file. Offer reload with an unsaved-change warning, or Save As a separate copy.
- Save As is explicit; duplicate filenames do not imply the same file identity.
- On network/save failure, keep the plugin's edits and offer local workbook download/save for recovery. Show a clear unsaved state.
- Ordinary use stays Open → work → Save. No live synchronization, long-lived edit locks, presence indicators or merge engine.

Verify whether the existing modification-time/size revision is sufficient for both save paths; strengthen the shared revision mechanism if necessary, not just the plugin endpoint. Reuse short write locks already present; these are not user-facing collaborative edit locks.

## Material and seamstress integration

Persist project data first; add physical production labeling as a bounded follow-up.

- CRM currently attaches materials to tasks, while Print Tools uses numbered packing material slots. Add explicit product/slot-to-CRM-material assignments; a task's material list alone cannot identify which parts use which fabric.
- Separate incompatible physical materials even when their template slot numbers match. Do not infer assignments from list order or material names.
- Show resolved material names in production summaries/output layers. Material width can suggest settings, but must not silently replace validated usable roll width.
- Extend the existing named-text personalization mechanism for optional project/product/seamstress identification placed deliberately by the template author.
- Do not automatically insert labels outside garment bounds or change packing geometry. Artwork remains manually authored; separated pieces should carry enough approved identification for sorting.

## Implementation sequence and acceptance gates

### 1. Prove the workbook roundtrip

Progress: candidate contract in `docs/production-workbook-v1.md`, fixture in `docs/fixtures/production-v1.xlsx`, checker in `scripts/verify-production-workbook.mjs`. Actual office and plugin roundtrips remain unverified; follow the manual gate in the contract before milestone 2.

Document the v1 contract and create one small fixture with multiple products, blank fields, Latvian characters, `07`, artwork references and non-default setup values. Open/edit/save/download it through the existing office suite and read it with the intended plugin tooling. Verify both directions before building broader integration.

### 2. Add durable project-file support to CRM

Progress: staff-only storage and task-scoped list/open/create/save/download/recovery APIs are implemented, with server-controlled designation, composite file/task association, SHA-256 revisions shared by both save paths, previous-copy retention and ordinary-cleanup protections. Active/completed task pages have a separate no-upload Production table field with on-demand read-only previews and Edit/Download. Task deletion is blocked while saved projects exist. See `docs/production-projects.md` for migration/deployment requirements and remaining acceptance work. One-click CRM draft generation is now connected and can populate the field; plugin Save As remains unconnected. The office/plugin roundtrip gate remains unverified, so this is not a cutover approval.

Add the dedicated Production table task field using existing file-row/card styling but no file-upload controls. Add minimal file categorization/association, exclude its entries from ordinary attachments, and implement task-scoped list/open/create/save access, completion retention and previous-copy recovery. Populate it through generation or plugin Save/Save As, with server-side designation and validation. Reuse document storage helpers and existing save safety. Test permissions and failure paths with temporary files and test data, not live customer records.

### 3. Consolidate production configuration and AI

Progress: `/razosana` provides a staff-only CRM-backed production product/size-label library with base flags, localized navigation, validation and an isolated mocked self-check. See `docs/production-library.md`. Shared CRM source parsing, disclosed direct-action paid Gemini consent, local structured imports, automatic draft persistence and immediate preview/Edit are now implemented; see `docs/production-parsing.md`. Keys/models are now editable in Settings with write-only key handling, bounded model discovery and rejection of stale paid consent; legacy env values remain a first-save compatibility fallback only. The old API remains unchanged; native capture storage, parts, commercial-product mappings, desktop authentication and plugin cutover are not implemented yet. This independent library work does not satisfy or bypass the workbook roundtrip gate.

Implement CRM equivalents of the current plugin API functions, product mappings and desktop authentication. Keep old API available until cutover verification. Recapture a small test product against the CRM. Move shared parsing so either UI can create the normalized workbook. In CRM, implement explicit attachment/WYSIWYG-text/WYSIWYG-image/direct-paste source selection, automatic source inspection and the lightweight saved-draft preview with Edit, without mandatory Preview/approval/Save steps. Reuse that table to preview saved workbooks without loading the office suite.

### 4. Implement plugin Open / Save / Save As

Load CRM task files into the existing order grid/settings and save edits back to the same file. Preserve native grid behavior, explicit product/artwork rules and unsaved edits on failure. Prompt before replacing dirty work. Do not claim restored workbooks restore Corel masters; Prepare is still required in the current document.

### 5. Verify cutover and retire the standalone API

Test from a fresh Corel process: authenticate → open task workbook → edit → save → open in CRM → edit/save → reopen in plugin → Prepare → Generate using fresh captures. Verify remaining API consumers, then remove the old service/configuration. No captured-data migration is required.

### 6. Add production handoff details

Implement explicit material assignments and template-controlled labels. Optionally record a small generation receipt linking task, workbook revision, build, counts and timestamp. Call this “generated,” never automatically “printed” or “completed.” Receipts are not a blocker for project-file persistence.

## Verification checklist

- CRM and plugin can each open and save the same production workbook.
- Parsed/generated workbooks appear in the dedicated Production table field with familiar file styling, not in the ordinary attachment list. The field has no upload/add-files/drop-zone control.
- Ordinary uploads, including a file named `production.xlsx`, cannot implicitly designate a production workbook. Parsing-source uploads remain available separately; originals stay in their original location.
- Plugin Save updates the designated entry and Save As creates another designated project without duplicate regular attachments.
- Download/reupload and Save As preserve supported data/settings and do not grant access based on embedded IDs.
- `07`, Unicode, row order, blank fields and product references survive roundtrips.
- Unsupported schemas, formulas, invalid files and size-limit violations fail without data loss.
- A stale save is rejected; current unsaved edits remain recoverable.
- Unauthorized users cannot list, read or modify another client's project; staff-only data remains protected.
- Office-suite Save makes the new revision available to the plugin; unsaved browser edits are not mistaken for saved content.
- Completed tasks retain project workbooks; previous-copy recovery and file/database backup restore work.
- Existing source attachments/design files are not overwritten or unexpectedly processed.
- CRM parsing and plugin parsing use the same backend rules without unapproved paid calls.
- CRM can generate a size list from an attachment, WYSIWYG text, a selected pasted WYSIWYG image, or directly pasted chat-style text/screenshot; no separate source-file upload is mandatory.
- Source selection/preview identifies the exact submitted content. Multiple editor images and mixed text/image content cannot silently include unrelated artwork; paste/select alone makes no paid request.
- Parsed rows and saved workbooks display a lightweight preview with an Edit button. The office suite is not initialized until Edit is requested.
- Failed parsing preserves the source and previous work. Draft previews are visibly unsaved; office/plugin saves refresh the saved preview to the correct file revision.
- Run CRM document workflow self-checks, `pnpm check`, `pnpm lint` and `pnpm build` when implementing CRM changes.
- Run the existing plugin regression scripts and real Corel acceptance for plugin changes. Follow plugin version/build/staging discipline; document-only planning requires no version bump.

## Explicit non-goals

- Saving or synchronizing Corel artwork, generated jerseys, prepared masters or undo history.
- Migrating existing captured-size data.
- Real-time collaboration, automatic merges or continuous two-way synchronization.
- A custom CRM spreadsheet editor or garment-row database model.
- Automatic processing of design files, automatic printing or automatic task completion.
- A separate integration server, duplicate AI setup or a new generalized document-management platform.
- WhatsApp account integration, chat synchronization or automatic extraction from all WYSIWYG content.

## Decisions to settle during implementation

- Exact workbook fields and XLSX library support for lossless supported roundtrips.
- Desktop authentication flow and whether the external client needs plugin access; office editing is currently staff-only.
- Minimal metadata/migration for production-file designation, previous-copy storage and retention.
- Whether one CRM product maps directly to production configuration or several commercial variants share it.
- Physical material assignments and the approved template placement/content of production labels.

These details do not change the core decision: the CRM stores the project workbook, and the office suite and Print Tools are two editors of that file.
