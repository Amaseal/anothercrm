# Editable Gemini settings

Staff can edit the shared Gemini key and model at **Settings → Gemini settings** (`/iestatijumi#gemini`). No restart or environment-variable change is needed after Save. This is global CRM configuration, not a separate setting per user/task or a change to the old standalone plugin API.

## Deploy

Review/apply `drizzle/0039_calm_vargas.sql` with the usual `pnpm db:migrate` process before deploying the new code. It creates a singleton `gemini_settings` row/table for the key/model, constrained to ID 1. The migration has no credentials or seed values copied from the environment. Existing production migrations `0037`/`0038` are still required for task workbooks.

The migration was generated and reviewed, **not applied to the configured database** during implementation.

## Editing

- Enter a new API key to replace the current key. The password field is always empty; existing keys are never returned to the browser, even for staff.
- Leave the key blank to keep it. Model-only saves preserve the latest stored key, including a concurrent key rotation by another admin.
- Check **Remove the saved key** to disable AI parsing explicitly. Removing a key never revives an older environment key. Replacing/removing the CRM value does not revoke the old key at Google; revoke it there separately when required. Blank the model to disable AI while retaining the key.
- **Refresh models** queries Google's model-list endpoint using the entered key if present, otherwise the configured key. It does not save the entered key or make a generation request. Select a suggestion or enter an exact model ID manually; the catalog is not hardcoded.
- Save/Refresh never run paid compatibility tests. Discovery filters supported `generateContent` models and known special-purpose model names, but does not prove image/PDF/JSON support. Confirm actual compatibility only with an explicitly approved parsing request.

Until a database settings row exists, legacy `GEMINI_API_KEY` / `GEMINI_MODEL` env values remain a compatibility fallback. The first Save adopts the current env key if the key field is blank, unless removal is explicitly checked. After any Save, database values are authoritative, including empty/disabled values. Env variables can then be removed after verifying the saved configuration.

Open task choosers retain the configuration revision the user approved. Changing either the key or model rejects stale paid-parsing requests **before contacting Gemini**. The always-visible source chooser refreshes settings on focus or a stale-request error. Check the current model notice and click Generate again; no consent checkbox is required and the source/result is preserved. An already-started request keeps its approved key/model snapshot and may finish or be billed; editing settings does not cancel it.

## Security and storage

- Only authenticated admins may read public configuration status, save settings or refresh models. Clients cannot access the controls/endpoints and receive no Gemini configuration in Settings page data.
- Public status contains only readiness, key-present flag, model ID, source and an opaque configuration revision. No raw key or partial-key preview is returned.
- The API key is stored as **server-only text in PostgreSQL, not application-encrypted**. Restrict DB roles/network access, protect/encrypt database backups and use HTTPS for the CRM. Managed-key encryption is a separate hardening step if database-only disclosure is in scope; no new deployment master secret/crypto subsystem was added.
- Save handlers do not log caught database errors, because driver errors can contain SQL parameters with the submitted key. Upstream error bodies and network exceptions are not forwarded/logged. Model discovery has bounded responses/pagination, a 20-second timeout, fixed provider origin, no redirects and no retries.
- Keys never enter task descriptions, production workbooks, client-side persistent storage or the old plugin's shared API credential.

`POST /api/production-ai/models` accepts an optional multipart `apiKey` and returns only model IDs/display names, with private/no-store caching. It never mutates settings. The Settings action `?/updateGemini` accepts `apiKey`, `model`, and optional checkbox `removeKey=on`.

Paid parse requests now additionally require the current `aiRevision` from the task parsing context. This is separate from the source-content revision; both must match before making the paid request.

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

The settings self-check uses fake credentials, an in-memory mocked database and mocked model discovery/generation. It verifies direct authorization and client isolation, write-only status/load data, env adoption, immediate model/key changes, blank-key preservation including concurrent rotation, removal without env resurrection, validation, secret-safe save/provider errors, bounded paginated discovery without generation, and rejection of stale paid consent. No live database records or provider calls are used.

Implementation results: all seven document/production/settings self-checks passed with mocks/temporary files; `pnpm check` passed with zero errors/warnings; `pnpm build` passed with existing dependency circularity warnings. New settings helpers, component, API and modified parsing code passed targeted ESLint/Prettier. Repository-wide lint still reports the existing 589 errors and 1 warning. The migration, live provider/model discovery and interactive browser checks were not run.

Manual acceptance pending after migration: save/replace/remove a test key, refresh current models, enter a manual model ID, verify blank-key behavior, inspect client/admin responses for leakage and confirm open task choosers reject old consent without losing their proposal. Real model accuracy/compatibility tests remain opt-in paid operations; no such tests were run during implementation.

Provider reference: [Gemini Models API](https://ai.google.dev/api/models).
