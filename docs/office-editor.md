# In-app office editor

`/dokumenti` embeds [ranuts/document](https://github.com/ranuts/document) and saves files through the CRM. The editor is served at `/office/editor.html` by the **same SvelteKit/Node server**. No separate service, hostname, DocumentServer, React dependency or editor account is needed.

## Local setup

```sh
pnpm office:prepare
pnpm dev
```

The preparation command downloads a pinned ~217 MB static layer from the publisher's container registry, verifies its SHA-256 and extracts it using `tar`. It does **not** run a container. Generated files go in `.office/`; downloads are cached in `.cache/office/`. Neither directory belongs in Git. A streaming SvelteKit route serves `.office/` at `/office/`, keeping the large vendor bundle out of Vite's build/precompression pipeline. Repeat preparation only when updating/recreating the editor assets.

Source revision: `d1c9b03263aabe14789297f5c717fefff2fe4f0d`.
Image: `ghcr.io/ranuts/document@sha256:5e71d767e15d3c7b056eb7bf75f6f1fedf389095cd463de442c01d384d29336b`.
Static layer: `sha256:fcd18951bcfec469c95defc213a12fb20e1e18318dc7551a95832f0db3d7b25b`.

The preparation script prefixes absolute asset paths with `/office/`, disables automatic service-worker registration and decompresses the converter's WASM into a normal `.wasm` file. The preparation step also writes gzip sidecars sequentially. The asset route supplies the correct MIME types, negotiates gzip and supports ETag revalidation. This avoids special reverse-proxy headers and keeps the editor from controlling CRM pages. Upstream source and modification details are also available in `/office/CRM-INTEGRATION.txt`; upstream `LICENSE` and `NOTICE` are retained.

## Production

The Dockerfile copies static files from the pinned image into the existing builder and runs the same preparation script. Only the usual CRM Node container runs in production. The old `PUBLIC_ONLYOFFICE_HOST_URL` setting is no longer used.

For a non-Docker build, run `pnpm office:prepare` before `pnpm build`, and keep `.office/` alongside `build/` in the runtime working directory.

Adapter-node needs `BODY_SIZE_LIMIT=27262976` (26 MiB including multipart overhead). Docker sets this. Reverse proxies also need to accept that request size. The application validates individual files at 25 MiB.

The runtime bundle includes fonts and WASM and is substantial; the first editor open is heavier than a text-only editor. It is not a lightweight rich-text widget.

## Scope

- Create DOCX and XLSX documents through **Add** → name and type → **Create**. Both fields are required in the modal and on the server. Upload DOCX/XLSX/PPTX/CSV.
- Eligible files in project attachment lists and the Files screen have an **Open in editor** button for staff. It opens a new tab to preserve unsaved project fields. Existing project attachments use database IDs so saving also updates file metadata.
- Staff-only listing, opening, saving and authenticated download API.
- English editor UI; the surrounding CRM controls/errors are translated into English and Latvian. Upstream's current UI locale list does not include Latvian.
- The CRM **Save** button exports the edited file and uploads it. The editor's own download/export controls can be used to keep a local copy.
- **Back to documents** returns to the document list. A toast confirms successful CRM saves; edits made during a save remain marked unsaved.
- Unsaved-change warnings cover in-app navigation, reloads and tab/window closing. Native unload-dialog wording is controlled by the browser. Save failures retain the current editor contents.
- Files keep their original format. Legacy DOC/XLS/PPT originals are not changed; convert a copy to OOXML before uploading it in this version.
- No collaboration, AI setup, PWA or offline mode is configured.
- The upstream image does not bundle spell-check dictionaries; dictionary requests can return 404. Editing and saving do not depend on them.

## Save safety

File paths are constrained to local uploads, formats and size are validated, and edited files are flushed to a temporary file before atomic replacement. A SHA-256 revision of the actual bytes rejects stale saves, including same-size/same-timestamp changes. A per-file `.lock` prevents simultaneous writes. Office Save and task-production Save/recovery use the shared writer in `src/lib/server/documents.ts`; metadata-update failure attempts to restore the original bytes. Designated production workbooks also require contract validation and retain one previous successful copy. See `production-projects.md` for the private storage, migrations and recovery API.

A process crash may leave `<filename>.lock` in `uploads/`. After confirming that no save is running, remove that lock and reopen the document. Never delete upload documents to clear a lock.

Database-managed and existing filesystem-only documents are supported. Ordinary document editing requires no additional migration; the separate task-production feature requires its documented migrations.

## Verification

```sh
pnpm exec paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
node scripts/verify-office.mjs
node scripts/verify-document-workflow.mjs
pnpm check
pnpm lint
pnpm build
```

The self-check exercises real load/save/download handlers using unique temporary files; it never mutates database records. Manually verify: create/upload, edit, CRM Save, reopen, download; an unsaved-navigation prompt; and a stale save from a second tab.

## Licensing

The embedded editor is AGPL-3.0 and incorporates ONLYOFFICE with additional notices and third-party licenses. Preserve the supplied legal notices and review source-availability obligations before deployment. Hosting an iframe in this app is not a licensing exemption. `scripts/prepare-office.mjs` contains the integration modifications; do not represent this as a pristine upstream build.
