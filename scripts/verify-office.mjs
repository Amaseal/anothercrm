import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'vite';
import { relocateOfficeAsset } from './prepare-office.mjs';

// Run with: pnpm exec paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
//           node scripts/verify-office.mjs
// Uses unique temporary upload files and no database mutations.
assert.equal(relocateOfficeAsset('"/sdkjs/x.js"'), '"/office/sdkjs/x.js"');
assert.equal(relocateOfficeAsset('url(/fonts/a.woff2)'), 'url(/office/fonts/a.woff2)');
assert.equal(relocateOfficeAsset('`serviceWorker`in navigator'), 'false');
assert.equal(relocateOfficeAsset('"/working/fonts/a"'), '"/working/fonts/a"');
assert.equal(relocateOfficeAsset('x2t.wasm.br'), 'x2t.wasm');
assert.equal(
	relocateOfficeAsset('https://example.com/sdkjs/a.js'),
	'https://example.com/sdkjs/a.js'
);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const filename = `office-selfcheck-${randomUUID()}.docx`;
const path = join('uploads', filename);
const id = `fs:${filename}`;
const locals = { user: { id: 'test-staff', type: 'admin' } };
const zip = async (text) => {
	const archive = new JSZip();
	archive.file('[Content_Types].xml', '<Types/>');
	archive.file('word/document.xml', `<document>${text}</document>`);
	return archive.generateAsync({ type: 'nodebuffer' });
};
try {
	const { GET: officeAsset } = await server.ssrLoadModule(
		'/src/routes/office/[...path]/+server.ts'
	);
	const assetEvent = (path, headers = {}) => ({
		params: { path },
		request: new Request('http://localhost/office/test', { headers })
	});
	for (const path of [
		'../package.json',
		'../../uploads/secret.docx',
		'bad\\path.js',
		'bad\0path.js'
	]) {
		await assert.rejects(() => officeAsset(assetEvent(path)), { status: 404 });
	}
	const raw = await officeAsset(assetEvent('editor.html', { 'accept-encoding': 'gzip;q=0' }));
	assert.equal(raw.headers.get('Content-Type'), 'text/html');
	assert.equal(raw.headers.has('Content-Encoding'), false);
	const rawBytes = Buffer.from(await raw.arrayBuffer());
	const compressed = await officeAsset(
		assetEvent('editor.html', { 'accept-encoding': 'gzip, deflate' })
	);
	assert.equal(compressed.headers.get('Content-Encoding'), 'gzip');
	assert.deepEqual(gunzipSync(Buffer.from(await compressed.arrayBuffer())), rawBytes);
	const revalidated = await officeAsset(
		assetEvent('editor.html', { 'if-none-match': raw.headers.get('ETag') })
	);
	assert.equal(revalidated.status, 304);
	const wasm = await officeAsset(
		assetEvent('sdkjs/common/wasm/x2t/x2t.wasm', { 'accept-encoding': 'gzip' })
	);
	assert.equal(wasm.headers.get('Content-Type'), 'application/wasm');
	assert.equal(
		gunzipSync(Buffer.from(await wasm.arrayBuffer()))
			.subarray(0, 4)
			.toString('hex'),
		'0061736d'
	);
	const helpers = await server.ssrLoadModule('/src/lib/server/documents.ts');
	const { actions, load } = await server.ssrLoadModule(
		'/src/routes/(app)/dokumenti/[id]/+page.server.ts'
	);
	const { GET } = await server.ssrLoadModule('/src/routes/api/documents/[id]/+server.ts');
	const listing = await server.ssrLoadModule('/src/routes/(app)/dokumenti/+page.server.ts');
	for (const [user, status] of [
		[null, 401],
		[{ type: 'client' }, 403]
	]) {
		for (const handler of [
			GET,
			load,
			actions.save,
			listing.load,
			listing.actions.create,
			listing.actions.upload
		]) {
			await assert.rejects(() => handler({ locals: { user }, params: { id } }), { status });
		}
	}
	for (const invalid of [
		'fs:../secret.docx',
		'fs:..\\secret.docx',
		'fs:secret\0.docx',
		'-1',
		'NaN',
		'2147483648'
	]) {
		await assert.rejects(() => helpers.loadDocument(invalid), { status: 404 });
	}
	const original = await zip('Original content');
	const edited = await zip('Edited content is preserved');
	assert.ok(await helpers.validateDocumentUpload(new File([edited], filename), 'docx'));
	assert.equal(
		await helpers.validateDocumentUpload(new File([edited], 'wrong.xlsx'), 'docx'),
		null
	);
	assert.equal(await helpers.validateDocumentUpload(new File(['not a ZIP'], filename)), null);
	assert.equal(await helpers.validateDocumentUpload(new File([], filename)), null);
	assert.equal(
		await helpers.validateDocumentUpload(
			new File([new Uint8Array(helpers.MAX_DOCUMENT_SIZE + 1)], filename)
		),
		null
	);
	assert.ok(await helpers.validateDocumentUpload(new File(['Name,Count\nTest,2'], 'test.csv')));
	await mkdir('uploads', { recursive: true });
	await writeFile(path, original);
	const first = await load({ locals, params: { id } });
	assert.equal(first.document.filename, filename);
	assert.equal('path' in first.document, false);
	assert.match(first.document.downloadUrl, /^\/api\/documents\//);
	const response = await GET({ locals, params: { id } });
	assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
	assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
	const form = new FormData();
	form.set('file', new File([edited], filename));
	form.set('revision', first.document.revision);
	const event = { locals, params: { id }, request: { formData: async () => form } };
	const saved = await actions.save(event);
	assert.equal(saved.success, true);
	assert.notEqual(saved.revision, first.document.revision);
	assert.deepEqual(await readFile(path), edited);
	const conflict = await actions.save(event);
	assert.equal(conflict.status, 409);
	assert.deepEqual(await readFile(path), edited);
	form.set('revision', saved.revision);
	await writeFile(`${path}.lock`, 'another writer');
	assert.equal((await actions.save(event)).status, 409);
	assert.deepEqual(await readFile(path), edited);
	await rm(`${path}.lock`);
	form.set('file', new File(['broken'], filename));
	assert.equal((await actions.save(event)).status, 400);
	assert.deepEqual(await readFile(path), edited);
	const download = await GET({ locals, params: { id } });
	assert.deepEqual(Buffer.from(await download.arrayBuffer()), edited);
	console.log(
		'Office checks passed: asset paths, access control, upload validation, atomic save, conflict protection and fresh downloads.'
	);
} finally {
	await rm(path, { force: true });
	await rm(`${path}.lock`, { force: true });
	await server.close();
}
