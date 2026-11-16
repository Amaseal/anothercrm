# Print Tools compatible CRM API

The existing plugin library and production workflow now have compatible CRM endpoints under **`/api/print-tools`**. These read/write the same `production_products` / `production_sizes` used by `/razosana`, not the commercial catalog or the standalone API database. Parts and native captures are added by migration `0040_robust_ultimatum.sql`.

## Deployment — required before switching the installed plugin

1. Deploy CRM code with migrations `0037`–`0040`, using the normal reviewed `pnpm db:migrate` process. **0040 was generated/reviewed, not applied during development.** It only adds credential/parts/capture tables, constraints and indexes; no customer data is imported/deleted.
2. Allow **52 MiB** request bodies in the Node adapter and reverse proxy: `BODY_SIZE_LIMIT=54525952`. Docker's default was updated. Ordinary CRM routes retain the previous 26 MiB request ceiling through a streaming hook; documents retain their own smaller checks. Print Tools routes enforce their own 50 MiB native / 18 MiB AI / 64 KiB ordinary JSON limits after authentication.
3. As CRM staff, open **Production → Print Tools plugin connection**. Create a personal credential and copy the shown API URL and credential. The credential is shown once, lasts 90 days, is stored only as SHA-256 in CRM, and can be revoked by its owner. Account deletion/downgrade also prevents use. No shared old API key is accepted; credentials apply only to this API, not arbitrary CRM routes.
4. Publish/stage **plugin 1.27.0**, with Corel closed. In **Settings → CRM connection…**, paste that URL and credential, then **Check connection & save**. This checks authenticated `/health`, never a paid AI call. Windows Credential Manager stores the URL/token for the current Windows user; no plaintext config file or hardcoded token.
5. **Restart CorelDRAW completely.** Each loaded plugin assembly freezes one connection; saving another connection never silently rebinds existing product IDs, orders, captures or prepared masters to a different backend. There is **no fallback** to `tools.fastbreak.lv`.
6. Size Settings now lists CRM production products/sizes/base flags. Add/capture against the CRM library. Old standalone captures are not moved or matched by ID/title; recapture against the intended CRM product. Do not delete/retire the old API until actual acceptance.

**At development completion only the source is switched.** Plugin 1.27.0 was compiled, not published/staged; the previously staged 1.26.0 remains unchanged until step 4. No live database mutations, credential creation, API deployment or paid requests were performed by the agent.

## Compatible routes

All requests require `X-Api-Key: pt_<personal credential>`. Missing, expired/revoked or non-staff credentials fail before business operations. JSON responses/errors use the existing plugin's field shapes, including `svgContent` for the opaque native envelope (not actual SVG).

| Method       | Route after `/api/print-tools`               | Result                                                                 |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| GET          | `/health`                                    | Authenticated CRM backend marker/version                               |
| GET / POST   | `/products`                                  | List/create production products                                        |
| DELETE       | `/products/:id`                              | Delete product and its size/part/capture children                      |
| GET / POST   | `/products/:id/parts`                        | `{name,isBase}[]` / add part                                           |
| DELETE       | `/products/:id/parts/:name`                  | Delete template part; native formations are independent                |
| PATCH        | `/products/:id/parts/:name/base`             | `{isBase}`; reject another active base part                            |
| GET          | `/products/:id/sizes`                        | Size-label strings                                                     |
| GET          | `/products/:id/sizes-with-base`              | `{label,isBase}[]`                                                     |
| POST         | `/products/:id/sizes`                        | `{label}`; idempotent add                                              |
| DELETE       | `/products/:id/sizes/:label`                 | Delete size and its capture                                            |
| PATCH        | `/products/:id/sizes/:label/base`            | `{isBase}`; atomic base switching                                      |
| GET          | `/products/:id/library`                      | Metadata only: `id,sizeLabel,capturedAt,hasSvg`                        |
| POST         | `/products/:id/library`                      | `{size,svg}` native capture upsert for a registered size               |
| GET          | `/products/:id/captured-sizes`               | Captured size-label strings                                            |
| GET          | `/products/:id/size-shapes?size=...`         | One size's full capture                                                |
| GET          | `/products/:id/library/shapes?size=S&size=M` | Requested captures; legacy `sizes=S,M` also accepted                   |
| GET / DELETE | `/library/:id`                               | Read/delete capture                                                    |
| GET          | `/settings/ai`                               | Shared CRM readiness/model/revision, never a key                       |
| GET          | `/settings/ai/models`                        | Bounded Google model discovery, no generation                          |
| PUT          | `/settings/ai/key`                           | `{key}` replaces shared CRM key                                        |
| PUT          | `/settings/ai/model`                         | `{modelId}` saves shared CRM model **without paid testing**            |
| POST         | `/orders/parse`                              | Existing `ext,text,imageBase64` plus `paidConsent:true,aiRevision`     |
| POST         | `/reports/inspect`                           | Existing `size-overview-v2` payload plus `paidConsent:true,aiRevision` |

Names/labels/IDs and streamed JSON sizes are validated. Mutations and capture batch reads lock the parent product, including concurrent browser size/base changes. Database uniqueness/FKs enforce one size capture, unique parts/sizes and at most one base flag. SQL errors are never returned/logged with credential/native-payload parameters. Responses are `no-store`; no public upload path exposes captures.

## Native capture safety

Only current `cdrole|base64(storage)|base64(object descriptor)|base64(application descriptor)` envelopes are accepted: canonical base64, 36 MiB combined raw bytes, 64 KiB per descriptor, compound-storage signature and Object Descriptor header/string-offset validation. Pre-native CDR/CMX and SVG are rejected with recapture guidance. Captures remain in PostgreSQL, linked by size FK with cascade deletion.

Native bytes/descriptors are preserved unchanged, including the saved origin descriptor. The plugin still omits Application Descriptor during restoration and performs its full Windows OLE storage/tree/native-stream validation before PasteEx. The server does not execute or claim to fully interpret opaque OLE storage. No native captures enter XLSX workbooks.

Full batch payloads are capped at 60 MiB before loading them from DB; plugin 1.27 retries an oversized **GET** batch as individual requested sizes. Single/batch native transfers use 90-second timeouts and 64 MiB response bounds. No paid request is retried automatically.

## Shared Gemini behavior

CRM Settings and plugin Settings now edit the same key/model immediately. Saving/refreshing never make paid compatibility tests. The plugin's former Test & save action is labelled **Save model**; discovered availability is not proof of image/PDF/JSON capability.

Parsing uses **the CRM prompt**, including one row per actually ordered garment: jersey + shorts duplicate the person/number with garment-specific sizes and `jersey` / `shorts` artwork labels. Leading zeros and incomplete rows are retained; explicit stable CRM product references resolve only to existing CRM products. Raw source product labels remain unresolved—never title-match/infer an ID. The client now imports Artwork, ProductId and UnresolvedProduct instead of discarding them.

Text is limited to 128,000 characters. PNG/JPEG/PDF input is validated and capped at 12 MiB decoded; **the selected whole PDF is sent inline to Google**, unlike the old standalone text-extraction path. The plugin discloses that Parse with AI sends the selected source and may incur charges. Visual review preserves the existing compact schema, explicit confirmation, advisory-only behavior and bounded concurrency. Both parsing/review submit the configuration revision captured for that action; changes reject stale consent before a paid request. In-flight requests may still be billed. Model discovery is free metadata, not a paid test.

Review validation/prompt is ported from the standalone `size-overview-v2` implementation; shared CRM settings and bounded response/cancellation transport replace its old configuration. The existing narrow rotated/clipped output schema is unchanged. Real accuracy, provider support, budgets/quotas and artwork/PII-sharing acceptance remain necessary.

## What is not part of this switch

- Direct task/project selection and remote workbook Open/Save/Save As from the plugin. Existing project APIs still require CRM sessions; these credentials do not bypass that authorization.
- Feeding an opened workbook into the production grid/Prepare/Generate. The separate 1.26 local workbook editor remains isolated; no prepared Corel session is restored from a file.
- Commercial-product mappings, material assignment UI, automatic capture migration, live synchronization or old API retirement.

## Verification status

CRM TypeScript/Svelte diagnostics and managed plugin compilation passed during implementation. The user asked to skip test suites: the new `scripts/verify-print-tools-api.mjs` and updated library/plugin self-checks were **not run**. No actual database migration, browser credential flow, native recapture, Corel production, provider parsing/review or direct Office/plugin roundtrip was verified.

When authorized, run the offline self-checks first, apply the migration on a test DB, then use a disposable product/size: compare browser/plugin lists and base flags, capture/paste several sizes, revoke/expire a test credential, test stale AI configuration without billing, and exercise Prepare/Generate/QA on a saved disposable Corel document. Paid provider checks remain opt-in.
