# Production workbook v1 — roundtrip candidate

Status: fixture and offline acceptance check implemented. **Not approved for production** until the embedded editor and a plugin project reader/writer pass the roundtrip gate. No production endpoints, database changes or plugin changes are introduced by this milestone.

## Scope and tooling

Use XLSX with two visible sheets, in order: `Orders`, `Setup`. All populated cells in these sheets are text, including numbers and settings. Coordinates start at A1. No formulas (including array formulas), macros, hyperlinks, merged cells or external data connections belong in this format. No credentials, images, native captures or prepared Corel state belong in it.

The CRM already installs SheetJS (`xlsx`); the offline fixture uses that dependency without adding another package. The plugin currently uses ZIP/XML to extract spreadsheet text (`TextChecker.ReadXlsxFile`), not to load/save projects. That extractor is **not** a project reader. Select and verify plugin read/write tooling before implementing project saves.

SheetJS rewrites are not assumed to preserve arbitrary workbook content. A future save implementation must either preserve unrelated content with verified tooling or reject unsupported structures **before overwriting**. This fixture checker is not the production upload validator: it does not enforce bounded ZIP expansion or inspect every OOXML relationship/feature. Do not expose it to untrusted uploads.

## Orders

Exact headers A1:E1: `Name`, `Size`, `Number`, `Artwork`, `Product`.

- One row per garment; preserve order, Unicode and exact text. Ignore wholly empty trailing rows. Maximum 10,000 garments. Interior blank rows are invalid in non-draft workbooks because Size is required; generated drafts can retain incomplete rows for correction.
- Name and Number may be blank. Number must be stored as text (`07` must remain `07`), not a numeric cell with display formatting. Generated Number cells also use Excel's text format `@`.
- Size must contain non-whitespace text. Artwork is optional when Product is blank; otherwise Artwork is required, matching `OrderImport.RequireArtwork` in the plugin. Artwork names reference manually authored Corel groups and must be checked during Prepare.
- Product is blank for the selected default or a stable reference `crm-production:<positive decimal ID>`. This namespace identifies the **future CRM production configuration**, not a commercial CRM product or the old standalone API's numeric ID. The fixture IDs are synthetic, not existing records.
- The Setup mapping `Product.<reference>` holds a display-name snapshot. Names never establish identity. Missing catalog entries or mappings must remain unresolved for correction; never substitute a product by title. Generation is blocked until references resolve. A workbook can retain unresolved references without losing their original text.

## Generated drafts

The simplified CRM flow is **select source → Generate → preview modal with Edit**. Generate automatically creates a separate workbook with `Setup.Draft = true` (text). This is a saved proposal, not an approved production order, and never replaces an existing workbook.

Only a marked draft may have a blank Size/default product, unresolved source Product text, or missing Artwork. The reader preserves those values and returns warnings so Edit can fix them; it never guesses a template or matches catalog names. Formulas, malformed files, unsupported versions, unsafe structures, packing limits and text-number rules are still rejected in drafts. The required DefaultProduct key must exist even when its value is blank.

`Draft` is optional text `true`/`false`; absence or `false` keeps the original strict validation. Existing fixtures/readers for non-draft workbooks retain their checks. All plugin readers/writers must preserve the marker and incomplete values, and perform full size/product/artwork/settings resolution before Prepare/Generate regardless of the marker. Viewing/saving a draft is not production approval and does not restore a Corel preparation session. Actual office/plugin draft roundtrip acceptance remains pending.

## Setup

Exact headers A1:B1: `Key`, `Value`. Unique nonempty keys; values are text. Row order is not significant. Maximum 1,000 data rows. Required fields are not silently defaulted when opening a saved project.

| Key                                 | Required               | Meaning / plugin default / accepted range                                            |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| FormatVersion                       | yes                    | Exactly `1`                                                                          |
| UsableRollWidthMm                   | yes                    | Decimal millimetres; default 1600; 100–5000                                          |
| SheetWidthMm                        | yes                    | Decimal millimetres; default 1500; 100–30000                                         |
| SheetHeightMm                       | yes                    | Decimal millimetres; default 1000; 100–30000                                         |
| GapMm                               | yes                    | Decimal millimetres; default 5; 0–100                                                |
| PackingProfileResolutionMm          | yes                    | Decimal millimetres; default 2; 0.5–20                                               |
| DefaultProduct                      | yes                    | Stable production reference; may be blank only with `Draft=true`                      |
| Draft                               | no                     | Text `true` for generated proposals; absent/`false` uses strict validation             |
| Product.<reference>                 | per referenced product | Display-name snapshot, never identity                                                |
| TaskReference                       | no                     | Informational task reference; grants no access or reassignment                       |
| ProjectTitleSnapshot                | no                     | Download-time context; current authorized CRM context takes precedence               |
| SeamstressSnapshot                  | no                     | Optional approved context; do not expose staff-only information to clients           |
| Material.<product reference>.<slot> | no                     | Explicit `crm-material:<positive decimal ID>` assignment; slot is a positive integer |

Use an invariant decimal point, no unit suffix, NaN or infinity. At least one sheet dimension must fit within the usable roll width, matching `JerseyPacker.ValidateRollWidth`. Material slots from different products do not imply matching physical materials. Missing assignments do not authorize guesses from task-material order or names. Material assignment controls and handoff labels remain milestone 6.

Fields/defaults were inspected in `addon/PrintToolsModern/MainForm.cs` (Size Settings), `ApiClient.cs` (OrderRow), `OrderImport.cs` (product/artwork rules) and `JerseyPacker.cs` in the sibling `corel code` repository. Material assignments are reserved here; they are not current plugin controls.

Unknown setup keys must be preserved or cause an explicit unsupported-workbook error before save, never silently dropped. Unsupported format versions require an actionable error and leave the current file/order untouched.

## Fixture and offline check

`docs/fixtures/production-v1.xlsx` contains four garments, two synthetic product references, Latvian names, `07`, `00`, blank optional values, explicit artwork, distinct material assignments and non-default packing settings. No real customer data is used.

```sh
node scripts/verify-production-workbook.mjs
# Recreate the committed fixture only when intentionally changing the contract:
node scripts/verify-production-workbook.mjs --write-fixture
# Compare an office/plugin-exported copy with the original semantic values:
node scripts/verify-production-workbook.mjs /path/to/roundtripped.xlsx
```

The checker tests its own rejection of numeric Number cells, formulas, missing sizes, explicit products without artwork, unsupported versions, invalid settings, changed headers and unexpected sheets. It compares all fixture values, not ZIP byte identity or style identity. It allows harmless trailing empty rows. It does not prove that the office suite preserves unsupported features.

## Implementation verification

- Offline fixture/self-check: passed.
- Existing `verify-office.mjs` and `verify-document-workflow.mjs`: passed.
- `pnpm check`: passed (0 errors/warnings) after generated Paraglide output was ready.
- `pnpm build`: passed; existing dependency circularity warnings remain.
- Targeted ESLint and Prettier checks for the new script/docs: passed.
- `pnpm lint`: blocked by 591 errors and 1 warning elsewhere in the working tree; unrelated files were not changed to address these.
- Interactive office roundtrip and plugin/Corel roundtrip: not run.

## Manual acceptance gate — still pending

1. Run the offline check. Upload a **copy** of the fixture to `/dokumenti` as staff; keep the fixture unchanged.
2. Open with explicit Edit. Inspect both sheets, Latvian text, product references, blank fields, `07` and non-default settings. Change a value and CRM Save; reopen and confirm the edit persists.
3. Restore the original value, CRM Save and download. Run the checker against that downloaded copy. Also inspect that both sheets remain visible. This restore step lets the checker compare exact fixture semantics while exercising edits.
4. Implement/select the plugin's project XLSX tooling and repeat plugin open → edit → save → CRM open/save → plugin reopen. Run the checker against a copy restored to the original fixture values.
5. Record editor build, plugin build, tested files and results here. Do not call either direction verified merely because SheetJS can read its own fixture.

No paid AI calls or live task/customer mutations are needed. Plugin/Corel acceptance and editor interaction cannot be replaced by the offline self-check. Broader persistence integration remains behind this gate.
