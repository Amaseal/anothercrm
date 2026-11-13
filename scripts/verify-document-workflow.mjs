import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { createServer } from 'vite';

// Run with: node scripts/verify-document-workflow.mjs
// All database methods are mocked; only unique temporary upload files are written.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const temporaryFiles = [];
try {
	const { getDocumentEditorId, MAX_DOCUMENT_SIZE } =
		await server.ssrLoadModule('/src/lib/documents.ts');
	const eligible = { id: 12, name: 'Quote.DOCX', path: '/uploads/stored-quote.docx', size: 100 };
	assert.equal(getDocumentEditorId(eligible), '12');
	assert.equal(getDocumentEditorId({ ...eligible, id: undefined }), 'fs:stored-quote.docx');
	assert.equal(
		getDocumentEditorId({ ...eligible, id: undefined, path: '/uploads/quote%20one.docx' }),
		'fs:quote one.docx'
	);
	for (const changes of [
		{ name: 'image.png' },
		{ name: 'legacy.doc' },
		{ name: 'macro.docm' },
		{ path: 'https://example.com/quote.docx' },
		{ path: '/uploads/../quote.docx' },
		{ path: '/uploads/a%2Fquote.docx' },
		{ path: '/uploads/bad%ZZ.docx' },
		{ size: MAX_DOCUMENT_SIZE + 1 },
		{ size: 0 }
	])
		assert.equal(getDocumentEditorId({ ...eligible, ...changes }), null);
	for (const extension of ['docx', 'xlsx', 'pptx', 'csv']) {
		assert.equal(getDocumentEditorId({ ...eligible, name: `test.${extension}` }), '12');
	}

	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const listing = await server.ssrLoadModule('/src/routes/(app)/dokumenti/+page.server.ts');
	const detail = await server.ssrLoadModule('/src/routes/(app)/dokumenti/[id]/+page.server.ts');
	const helpers = await server.ssrLoadModule('/src/lib/server/documents.ts');
	const locals = { user: { id: 'test-staff', type: 'admin' } };
	const create = (name, type) => {
		const form = new FormData();
		if (name !== undefined) form.set('name', name);
		if (type !== undefined) form.set('type', type);
		return listing.actions.create({ locals, request: { formData: async () => form } });
	};
	for (const [name, type] of [
		[undefined, undefined],
		['', 'docx'],
		['   ', 'xlsx'],
		['Quote', undefined],
		['Quote', ''],
		['Quote', 'pptx']
	]) {
		assert.equal((await create(name, type)).status, 400);
	}
	assert.equal((await create('a'.repeat(181), 'docx')).status, 400);
	assert.equal((await create('ā'.repeat(100), 'docx')).status, 400);

	let created;
	db.insert = () => ({
		values: (values) => ({
			returning: async () => {
				created = { ...values, id: 12, taskId: null };
				temporaryFiles.push(join('uploads', values.downloadUrl.slice('/uploads/'.length)));
				return [created];
			}
		})
	});
	for (const type of ['docx', 'xlsx']) {
		const name = `workflow-selfcheck-${randomUUID()}`;
		assert.equal((await create(`  ${name}  `, type)).id, 12);
		assert.equal(created.filename, `${name}.${type}`);
		const bytes = await readFile(temporaryFiles.at(-1));
		assert.equal(bytes.length, created.size);
		assert.ok(await helpers.validateDocumentUpload(new File([bytes], created.filename)));
	}

	// Project-linked records must open by database ID and update their metadata on save.
	const projectFile = { ...created, taskId: 45 };
	db.query.file.findFirst = async () => projectFile;
	assert.equal((await helpers.loadDocument('12')).filename, projectFile.filename);
	let metadata;
	db.update = () => ({
		set: (values) => ({
			where: async () => {
				metadata = values;
			}
		})
	});
	const form = new FormData();
	const archive = await JSZip.loadAsync(await readFile(temporaryFiles.at(-1)));
	archive.file('workflow-selfcheck.txt', 'An edit made through the document screen');
	const bytes = await archive.generateAsync({ type: 'nodebuffer' });
	form.set('file', new File([bytes], projectFile.filename));
	form.set('revision', (await helpers.loadDocument('12')).revision);
	assert.equal(
		(
			await detail.actions.save({
				locals,
				params: { id: '12' },
				request: { formData: async () => form }
			})
		).success,
		true
	);
	assert.equal(metadata.size, bytes.length);
	assert.deepEqual(await readFile(temporaryFiles.at(-1)), bytes);
	await assert.rejects(
		() => detail.load({ locals: { user: { type: 'client' } }, params: { id: '12' } }),
		{ status: 403 }
	);
	console.log(
		'Document workflow checks passed: required creation fields, Word/Excel creation, eligible links and project-file save-back.'
	);
} finally {
	for (const path of temporaryFiles) {
		await rm(path, { force: true });
		await rm(`${path}.lock`, { force: true });
	}
	await server.close();
}
