# CRM and Print Tools audit remediation plan

Status: **implementation started** by operator request. Finding numbers refer to the audit in the conversation. Progress below records source changes, not live acceptance or deployment.

## First implementation batch

- **Phase 1 / finding 7:** implemented in plugin source **1.27.2**. Production reads its visible default dropdown; Size Settings keeps independent library state. Refresh restores each selection independently, with no first-product substitution. Prepare/Generate, library capture/paste/delete and base-size behavior were traced. Focused regression assertions added/updated; managed compilation passed. Not staged.
- **Phase 2 / traversal portion of finding 2:** shared uploads-root and managed-URL validation now covers attachment ingestion, preview removal, task completion/deletion, ordinary removal, task-file operations and filesystem-manager guards. Managed task paths are all validated before their deletion starts; production workbooks remain excluded. Legacy external references are not treated as local files.
- **Phase 3 / invoice-management portion of finding 1:** create/edit/send/delete page loads/actions and import require staff at the handler. Existing guarded export/duplicate/renumber operations remain guarded. Authenticated HTML printing checks the client's association; **the emailed public PDF endpoint remains unchanged and anonymous**.
- **Phase 3 / finding 3:** nested task assignee/creator user queries now select explicit safe fields instead of loading password hashes. Includes active/edit/completed pages, completed queries and task creation events.
- Added/updated focused offline assertions in `verify-file-transfers.mjs`, `verify_invoice_download.ts`, `verify-task-user-data.mjs` and plugin selection/UI/workflow harnesses. **Not executed**, per the instruction to skip suites. CRM Svelte/TypeScript diagnostics passed with zero errors/warnings.
- No migration, commit/push, production deployment, plugin staging, live customer mutation, paid request or Corel operation was performed in this batch.

## Second implementation batch

- **Linked-client access:** the shared task guard now allows clients only linked-customer tasks or their own unassigned (`clientId = null`) drafts. Creator/assignee status no longer bypasses another customer's boundary. Staff retain all-task access. Active/completed board queries and event filtering use the same rule.
- **Task APIs:** added checks to moves, edit-session GET/POST/DELETE, associated task-file uploads/metadata/deletions and Nextcloud project sharing. Authorization failures remain 401/403 instead of being swallowed as generic 500s. Sharing is checked before any external request.
- **Office-only fields:** client edits preserve existing staff assignments, materials and seamstress values; forged client custom prices are ignored. Client task creation cannot set those office-only values. Customer IDs are validated against links; customer reassignment on existing tasks requires staff, even between two linked customers. Client pricing uses the selected task customer, not the first linked customer.
- **Returned data:** task create/edit/view/completed dropdowns and commercial-product price relations filter customer details and negotiated prices to linked IDs. Customer listing/count/detail queries are scoped. Product-management loads/actions and customer creation/merge/API handlers enforce staff checks directly; existing customer edit/delete staff restrictions remain unchanged. Product read access remains available to authenticated clients.
- **Events:** SSE sends only the event type needed to invalidate the board, not full task/customer/office payloads. Existing board event consumers were traced before reducing the payload.
- **Active uploads:** ordinary file responses now use `nosniff`, a script-blocking CSP and no-store caching; downloaded formats also receive an opaque-origin sandbox. HTML/SVG and other non-preview formats force attachment delivery; raster images and PDFs retain inline/range viewing. Existing URLs and the separate public invoice PDF endpoint remain unchanged. This is content-execution protection, **not private-file authorization**.
- Added `scripts/verify-client-access.mjs`; updated task-user, production-project and file-transfer assertions for the new access matrix, preserved fields, query scopes, minimal SSE and active-file headers. **Suites not executed.** JavaScript syntax checks, targeted ESLint (including the upload route; rooted the uploads ignore so source is no longer silently skipped) and Svelte/TypeScript diagnostics passed with zero errors/warnings. No browser/Nextcloud/PDF-viewer acceptance performed.
- No schema changes/migrations, live mutations, paid requests, plugin changes/staging, commit/push or deployment in this batch.

**Still pending:** uploader-backed ownership of unattached assets, attachment/description association validation, private file serving/download/removal authorization, explicit public-branding exceptions and shared-file retention. The ordinary upload route is **still publicly readable** until that work is done, and path-only removal/attachment flows are not yet fully permission-safe. Prior public cached responses can retain their old one-hour TTL. Task/file transactional cleanup, quantity/cent validation and other monetary fixes, password recovery, capture conflicts, async HTTP/JSON and cleanup/performance phases also remain pending. Do not treat these batches as completion of the full security plan.

## Agreed rules — do not change these

- **Invoice PDF links remain public.** Clients must be able to open the sent PDF URL without logging in. Do not add login requirements, signed-link infrastructure or a different sharing workflow as part of this work.
- **Staff can manage all tasks.** Do not introduce task-owner permissions or restrict staff by creator/assignee. Board filters are presentation preferences, not authorization.
- **Clients can manage only their own client's records.** Use linked client IDs. Being assigned to or having created a task must not grant access to another client's records. Preserve legitimate client-created drafts without allowing cross-client reassignment.
- **Registration/bootstrap is accepted** for this internal app: exclude finding **8**.
- **Plugin Git hosting is not required**: exclude finding **17**. Do not initialize/restructure plugin repositories.
- Keep native captures in PostgreSQL. Preserve OLE payloads/descriptors; do not change capture format, packing geometry, native paste or Corel threading unless a listed fix requires it.
- Existing credentials, production IDs, workbook identities and public invoice URLs should remain valid unless a password-reset/revocation operation deliberately invalidates credentials.

## Delivery order

Use small, separate patches. Fix selection/data-loss and access boundaries before performance or cleanup. Do not combine these with new features or a general rewrite.

### 1. Separate the plugin's two product selections — finding 7

**Targets:** `MainForm.cs`, `OrderGrid.cs` and the existing plugin UI/workflow checks.

- Give the Size Settings library its own selected product state.
- Read the production default from the production dropdown, not the library's selected product field.
- Audit every consumer: add/remove size, capture, paste, base-size selection, product deletion, refresh, Prepare and Generate.
- Keep the visible selection and the operation target consistent. Do not silently substitute the first product when a previous selection disappears.

**Acceptance:** Select production product A, inspect library product B, then Prepare: A is still the default. Capture/delete in Size Settings targets B. Neither view changes the other's selection.

### 2. Close unsafe file paths and protect private uploads — findings 2 and 6

**Targets:** upload/task-file/remove endpoints; upload serving; task create/edit/complete/delete; `file-download.ts` / `upload-storage.ts`; upload widgets.

- Use one uploads-root containment check for every physical read/delete. Reject traversal and invalid paths, including paths already stored in legacy records. Keep production-workbook protections intact.
- Stop trusting submitted attachment URLs as authority to create file references or unlink files. Resolve managed files server-side by ID, and validate the caller's access before association/removal.
- Record the uploader for unattached/draft assets. Backfill known task/file associations where possible; unresolved legacy assets should be staff-only, not assigned to a client by guesswork.
- Cover ordinary attachments, previews and editor images—not just the dedicated Production table.
- Require the appropriate access to private uploaded files. Preserve the deliberately public invoice PDF endpoint and any explicitly public branding assets.
- Prevent uploaded HTML/SVG from executing on the CRM origin: reject active formats where unnecessary or force attachment delivery with protective response headers. Do not rely on filename randomness.
- Preserve existing legitimate upload URLs where possible; avoid a bulk rename/move of customer files. Do not delete a shared physical file while another retained reference still needs it.

**Acceptance:** A saved path such as `/uploads/../package.json` can never reach filesystem deletion. Client A cannot access client B's private uploads. HTML/SVG upload links cannot execute CRM-origin scripts. Existing legitimate images/downloads and public invoice PDFs still work.

### 3. Apply the agreed access rules and return safe data — findings 1, 3, 4 and clarified 5

**Targets:** invoice management routes, task loaders/actions, customer loaders, task move/file APIs, nested user/product queries.

- Leave anonymous invoice PDF viewing/downloading working. Add staff checks inside invoice creation/edit/delete/send/import/export and other management handlers; do not rely on a parent layout or hidden controls.
- Reuse the existing task-access helper, adjusted to the agreed staff/client rules. Apply it consistently to task IDs and file associations in APIs as well as page actions.
- Staff retain access to every task. Clients cannot move/edit/attach/delete against another client's task by supplying its ID.
- Enforce staff-only fields server-side: custom prices, customer reassignment, staff assignments and other office-only fields. Hiding an input is not a restriction.
- Scope customer queries and product pricing to the current client's permitted records. Do not return every customer's contact details or complete negotiated-price arrays to clients.
- Replace broad nested `user: true` loads with explicit safe columns. Password hashes must never be serialized to any browser, including staff browsers.

**Acceptance matrix:**

| Caller    | Public invoice PDF | Invoice management | Task/file access                            |
| --------- | ------------------ | ------------------ | ------------------------------------------- |
| Anonymous | Allowed            | Denied             | Denied for private data                     |
| Client A  | Allowed            | Denied             | Only A's permitted records/drafts           |
| Client B  | Allowed            | Denied             | Cannot access A's records                   |
| Staff     | Allowed            | Allowed            | All tasks, regardless of assignment/creator |

Inspect returned data as well as rendered controls: no password hashes, unrelated client details or other clients' price lists.

### 4. Make saves atomic and recovery effective — findings 10, 11 and 13

**Task changes**

- Validate submitted relationships and values before modifying data.
- Put task details, materials, products, assignees, file associations and history into one database transaction.
- Keep the old preview/files until database commit succeeds. Perform physical cleanup after commit; cleanup failure must not destroy the last valid data or turn a committed change into a misleading failed save.
- Emit task events after commit. Reuse existing safe-file/cleanup patterns rather than introducing a new storage service.

**Password recovery**

- Update the password, consume reset credentials and revoke existing login sessions in one transaction.
- Revoke personal Print Tools credentials during password recovery, so a compromised credential cannot survive recovery.
- Apply a clear equivalent policy to profile password changes; rotate/reissue the current session or require login again rather than leaving old sessions active.
- Explain the intentional consequence: affected plugins need a newly issued credential.

**Native captures**

- Add a simple capture version, exposed in metadata and remembered by the plugin when the operator loads/selects the capture.
- Submit that observed version on overwrite. Check/update it under the existing parent lock; reject stale versions with a conflict instead of last-write-wins.
- Do not fetch a fresh version immediately before every upload and then blindly overwrite: that would defeat the check.
- Keep native bytes unchanged. No full history system or capture-format migration is needed to prevent stale overwrites.
- Coordinate server/client rollout. An older client missing the required version must receive a clear update-required response, not an unsafe silent fallback.

**Acceptance:** Failed task writes retain original database relations and files. A password reset blocks old sessions/credentials. Two workstations cannot silently overwrite each other's capture changes. No automatic retry of a conflicting write.

### 5. Correct invoice arithmetic and financial queries — findings 9 and 12

**Targets:** invoice create/edit calculations, their UI previews, customer revenue queries and dashboard aggregates.

- Validate finite quantities, integer-cent prices, discounts and tax inputs. Do not silently turn zero or invalid quantity into one.
- Round each invoice line to integer cents consistently, including undiscounted and fixed-discount lines, before calculating subtotal/tax/total.
- Share the calculation between create/edit and their previews instead of keeping independent formulas. Preserve the intended VAT/discount policy; do not redesign accounting rules in this patch.
- Aggregate invoices and uninvoiced tasks by identity before combining them. Remove `SUM(DISTINCT amount)` and joins that multiply unrelated task/invoice rows.
- Use the same corrected aggregates for customer summaries/rankings and dashboard revenue/profit. Keep document/status inclusion policy unchanged unless separately agreed.

**Acceptance:** 1.5 units at €0.99 saves as €1.49 for the line. Invalid/zero quantities are handled explicitly. Two separate €100 invoices count as €200; adding another invoice does not multiply product costs. Create/edit/PDF figures agree.

### 6. Remove plugin blocking HTTP and fragile JSON — findings 14 and 15

**Targets:** `ApiClient.cs`, catalog/capture event handlers, startup and relevant UI helpers.

- Replace handwritten JSON splitting/searching/escaping with installed/platform `System.Text.Json`. Preserve exact string numbers, Unicode, nulls, CRM references and existing DTO shapes.
- Move catalog/capture HTTP work off the WinForms UI thread. Keep Corel COM and native clipboard work on its required STA thread.
- Snapshot product/size/configuration before awaiting. Ignore stale results or disable only conflicting controls so a response cannot update the wrong selection.
- Keep bounded requests/responses, timeouts, safe errors, TLS checks and redirect protection.
- Preserve explicit paid consent/configuration revisions and the rule against automatic paid retries.
- Fix the small connection-dialog issue: after saving, refresh its saved connection snapshot before clearing the token input, so another blank-token Save uses the newly saved credential.

**Acceptance:** A slow/offline API does not freeze the plugin window. Changing selection during a request cannot mislabel/save its result. Valid JSON with spaces/Unicode escapes round-trips; `007` remains text. No Corel COM calls run on worker threads.

### 7. Delete dead code and avoid repeated large-file work — findings 16, 18 and 19

- Remove unregistered Text Check/Color Audit/Export tab builders, their unused fields/handlers and obsolete `ColorChecker` implementation after checking callers. Retain active generation QA and file-reading helpers still used by import/parsing.
- Use file metadata for production-project listings instead of reading/hashing every workbook on every focus refresh. Reuse/store revisions through the existing create/save/recovery writer, with a safe fallback for older records.
- Keep full byte/revision validation at open/save/conflict boundaries. A list optimization must not weaken stale-save protection or hide missing files.
- Share the bounded Gemini HTTP/response transport; keep order and inspection prompts/schemas separate. Preserve cancellation, completion checks, budgets and credential-safe errors.
- Update the existing focused checks and documentation as implementations converge. Do not add frameworks, replace the UI library or rewrite the packer.

**Acceptance:** A metadata refresh does not open every unchanged workbook. Opening/saving still validates actual content and detects stale revisions. One Gemini transport change reaches both callers. Removed legacy UI has no remaining active callers.

## Verification and rollout

The earlier instruction to skip test suites remains in effect until the operator approves execution. This plan does not run or authorize tests, paid requests, live DB changes or Corel operations.

When implementing:

- Add one focused regression per changed risk, reusing existing offline scripts/harnesses. Prioritize anonymous invoice management rejection with public PDF preservation, path containment, serialized secret removal, client separation, independent product selectors, money rounding and stale capture writes.
- Avoid repeated full-suite runs after every small edit. When authorized, run focused checks for each patch and one final CRM diagnostic/build plus managed plugin build.
- Use synthetic records and disposable files for transaction/failure checks. Never exercise deletion/traversal against real app/customer files.
- Generate/review necessary migrations; do not apply them to a live DB without rollout authorization. Expect schema work for capture versions and possibly upload ownership/file revision metadata.
- Ship CRM and plugin changes in coordinated batches. Stage plugin changes only with Corel closed, back up the installed files and verify version/dependencies. Do not claim a running Corel instance reloaded a DLL.
- Verify the public client invoice link, one staff workflow and the client-isolation matrix after deployment. Any paid Gemini accuracy check remains separately opt-in.

## Audit coverage

- **Adjusted:** 1 keeps public PDFs; 5 enforces only the agreed client/staff split, not task ownership.
- **Excluded by decision:** 8 registration/bootstrap; 17 plugin Git hosting.
- **Planned:** 2–7, 9–16, 18–19, plus the omitted small connection-dialog save-state issue.
- No unrelated registration redesign, repository hosting, public-link redesign, native format changes, packing changes or new integration features are included.
