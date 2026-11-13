import assert from 'node:assert/strict';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getTableName } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { createServer } from 'vite';

// Fake credentials + mocked fetch/DB: this script never calls a paid provider or changes live records.
const oldKey = process.env.GEMINI_API_KEY;
const oldModel = process.env.GEMINI_MODEL;
process.env.GEMINI_API_KEY = 'selfcheck-fake-key';
process.env.GEMINI_MODEL = 'gemini-selfcheck';
const originalFetch = globalThis.fetch;
const paths = [];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	db.query.geminiSettings.findFirst = async () => undefined;
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	const sources = await server.ssrLoadModule('/src/lib/server/production-sources.ts');
	assert.deepEqual(
		sources.editorImages(
			'<img src="https://example.com/remote.png"><img src="/uploads/../secret.png">'
		),
		[]
	);
	const parser = await server.ssrLoadModule('/src/lib/server/production-parsing.ts');
	const { readProductionWorkbook } = await server.ssrLoadModule(
		'/src/lib/server/production-workbook.ts'
	);
	const route = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-parse/+server.ts'
	);
	const preview = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-parse/source/+server.ts'
	);
	const save = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-parse/save/+server.ts'
	);
	const prefix = `parsing-selfcheck-${randomUUID()}`;
	const csvPath = `uploads/${prefix}.csv`;
	const imagePath = `uploads/${prefix}.png`;
	const secondImagePath = `uploads/${prefix}-second.png`;
	paths.push(csvPath, imagePath, secondImagePath);
	await mkdir('uploads', { recursive: true });
	const text = 'Name,Size,Number\n"BĒRZIŅŠ, JĀNIS",L,07\n,M,00\n';
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
		'base64'
	);
	await writeFile(csvPath, text);
	await writeFile(imagePath, png);
	await writeFile(secondImagePath, png);
	const task = {
		id: 45,
		title: 'Ādažu komanda',
		createdById: 'owner',
		clientId: 7,
		description: `<p>Do not submit unrelated editor text</p><img src="/${imagePath}"><img src="https://example.com/private.png"><img src="/${secondImagePath}">`
	};
	db.query.task.findFirst = async ({ where }) =>
		dialect.sqlToQuery(where).params[0] === 45 ? task : undefined;
	db.query.file.findFirst = async ({ where }) => {
		const query = dialect.sqlToQuery(where);
		assert.ok(query.sql.includes('"task_id"') && query.sql.includes('production_projects'));
		return query.params[0] === 91 && query.params[1] === 45
			? { id: 91, taskId: 45, filename: 'customer.csv', downloadUrl: `/${csvPath}` }
			: undefined;
	};
	db.query.file.findMany = async () => [
		{ id: 91, filename: 'customer.csv' },
		{ id: 92, filename: 'design.cdr' }
	];
	const products = [{ id: 10, name: 'Krekls' }, { id: 20, name: 'Šorti' }];
	let catalog = products;
	db.query.productionProduct.findMany = async () => catalog;
	let inserted = 0;
	let nextFileId = 100;
	let nextProjectId = 200;
	let generatedPath;
	db.transaction = async (callback) =>
		callback({
			select: () => ({ from: () => ({ where: () => ({ for: async () => [{ id: 45 }] }) }) }),
			insert: (table) => ({
				values: (value) => ({
					returning: async () => {
						inserted++;
						if (getTableName(table) === 'files') {
							generatedPath = `uploads/${value.downloadUrl.slice('/uploads/'.length)}`;
							paths.push(generatedPath);
							return [{ ...value, id: nextFileId++ }];
						}
						return [{ ...value, id: nextProjectId++ }];
					}
				})
			})
		});
	const staff = { user: { id: 'staff', type: 'admin' } };
	const event = (values = {}, locals = staff, signal = new AbortController().signal) => {
		const form = new FormData();
		for (const [key, value] of Object.entries(values)) form.set(key, value);
		return { locals, params: { id: '45' }, request: { formData: async () => form, signal } };
	};
	let calls = 0;
	let provider = async () =>
		new Response(
			JSON.stringify({
				candidates: [
					{
						finishReason: 'STOP',
						content: {
							parts: [
								{
									text: JSON.stringify([
										{ name: 'OZOLS', size: 'XL', number: '007', artwork: null, product: null }
									])
								}
							]
						}
					}
				]
			})
		);
	globalThis.fetch = async (url, options) => {
		assert.equal(
			url,
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-selfcheck:generateContent'
		);
		assert.equal(options.headers['x-goog-api-key'], 'selfcheck-fake-key');
		assert.equal(options.redirect, 'error');
		calls++;
		return provider(options);
	};
	for (const [locals, status] of [
		[{ user: null }, 401],
		[{ user: { id: 'owner', type: 'client' } }, 403]
	])
		for (const handler of [route.GET, route.POST, preview.POST, save.POST])
			await assert.rejects(() => handler(event({}, locals)), { status });
	const context = await (await route.GET(event())).json();
	assert.equal(context.attachments.length, 1);
	assert.equal(context.images.length, 2);
	assert.equal(context.ai.ready, true);
	assert.ok(!JSON.stringify(context).includes('selfcheck-fake-key'));
	assert.equal(calls, 0);
	await assert.rejects(() => preview.POST(event({ kind: 'attachment', fileId: '999' })), {
		status: 404
	});
	await assert.rejects(() => preview.POST(event({ kind: 'editor-image', imageIndex: '999' })), {
		status: 404
	});
	await assert.rejects(() => preview.POST(event({ kind: 'url', url: 'http://localhost/secret' })), {
		status: 400
	});
	for (const file of [
		new File(['not PNG'], 'fake.png'),
		new File(['not PDF'], 'fake.pdf'),
		new File(['legacy'], 'input.doc'),
		new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.pdf')
	])
		await assert.rejects(() => preview.POST(event({ kind: 'file', file })));
	await assert.rejects(() => preview.POST(event({ kind: 'text', text: 'a'.repeat(128001) })), {
		status: 400
	});
	const prepared = await (await preview.POST(event({ kind: 'attachment', fileId: '91' }))).json();
	assert.equal(prepared.text, text);
	assert.equal(
		prepared.engine,
		'local',
		'Standard tables must be recognized automatically without a paid request'
	);
	assert.equal(calls, 0, 'Source selection/preview must never call Gemini');
	await assert.rejects(
		() =>
			route.POST(
				event({ kind: 'attachment', fileId: '91', engine: 'ai', sourceRevision: prepared.revision })
			),
		{ status: 400 }
	);
	await assert.rejects(
		() =>
			route.POST(
				event({
					kind: 'text',
					text: 'changed',
					engine: 'ai',
					paidConsent: 'true',
					sourceRevision: prepared.revision
				})
			),
		{ status: 409 }
	);
	await writeFile(csvPath, text + 'CHANGED,XL,01\n');
	await assert.rejects(
		() =>
			route.POST(
				event({
					kind: 'attachment',
					fileId: '91',
					engine: 'ai',
					paidConsent: 'true',
					sourceRevision: prepared.revision
				})
			),
		{ status: 409 }
	);
	await writeFile(csvPath, text);
	assert.equal(calls, 0);
	const local = await (
		await route.POST(
			event({
				kind: 'attachment',
				fileId: '91',
				engine: 'local',
				sourceRevision: prepared.revision
			})
		)
	).json();
	assert.equal(local.orders[0].name, 'BĒRZIŅŠ, JĀNIS');
	assert.equal(local.orders[0].number, '07');
	assert.equal(local.orders[1].number, '00');
	assert.equal(local.orders[1].name, '');
	assert.equal(calls, 0);
	assert.throws(() => parser.parseStructuredOrders('unstructured text'), { status: 400 });
	const book = XLSX.utils.book_new();
	for (const name of ['First', 'Second'])
		XLSX.utils.book_append_sheet(
			book,
			XLSX.utils.aoa_to_sheet([
				['Name', 'Size', 'Number'],
				[name, 'L', name === 'First' ? '07' : '08']
			]),
			name
		);
	book.Sheets.First.C2 = { t: 'n', v: 7, z: '00' };
	const spreadsheet = () =>
		new File([XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })], 'customer.xlsx');
	const second = await (
		await preview.POST(event({ kind: 'file', file: spreadsheet(), sheet: 'Second' }))
	).json();
	assert.equal(second.sheet, 'Second');
	assert.ok(second.text.includes('Second') && !second.text.includes('First'));
	assert.deepEqual(second.sheets, ['First', 'Second']);
	const first = await (
		await preview.POST(event({ kind: 'file', file: spreadsheet(), sheet: 'First' }))
	).json();
	assert.equal(
		parser.parseStructuredOrders(first.text)[0].number,
		'07',
		'Displayed leading zeros in numeric source cells must become exact text'
	);
	book.Sheets.Second.C2.f = '7';
	await assert.rejects(
		() => preview.POST(event({ kind: 'file', file: spreadsheet(), sheet: 'Second' })),
		{ status: 400 }
	);
	const image = await (await preview.POST(event({ kind: 'editor-image', imageIndex: '1' }))).json();
	assert.equal(image.name, secondImagePath.slice('uploads/'.length));
	assert.equal(image.engine, 'ai');
	assert.equal(image.base64, png.toString('base64'));
	const paid = {
		kind: 'editor-image',
		imageIndex: '1',
		engine: 'ai',
		paidConsent: 'true',
		aiRevision: context.ai.revision,
		sourceRevision: image.revision
	};
	const goodProvider = provider;
	provider = async (options) => {
		const body = JSON.parse(options.body);
		assert.equal(body.contents[0].parts.length, 2);
		assert.equal(body.contents[0].parts[1].inlineData.data, png.toString('base64'));
		assert.ok(!options.body.includes('unrelated editor text'));
		return goodProvider();
	};
	const draft = await (await route.POST(event(paid))).json();
	assert.equal(draft.orders[0].number, '007');
	assert.equal(calls, 1);
	const pdf = new File(['%PDF-1.4\nmock document bytes'], 'customer.pdf', {
		type: 'application/pdf'
	});
	const pdfSource = await (await preview.POST(event({ kind: 'file', file: pdf }))).json();
	assert.equal(pdfSource.mime, 'application/pdf');
	assert.equal(calls, 1, 'PDF preview must not make a provider request');
	provider = async (options) => {
		const part = JSON.parse(options.body).contents[0].parts[1].inlineData;
		assert.equal(part.mimeType, 'application/pdf');
		assert.equal(part.data, Buffer.from(await pdf.arrayBuffer()).toString('base64'));
		return goodProvider();
	};
	await route.POST(
		event({
			kind: 'file',
			file: pdf,
			engine: 'ai',
			paidConsent: 'true',
			aiRevision: context.ai.revision,
			sourceRevision: pdfSource.revision
		})
	);
	assert.equal(calls, 2);
	assert.equal(inserted, 0, 'Parsing must not create or overwrite stored workbooks');
	for (const content of [
		{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '[]' }] } }] },
		{
			candidates: [
				{
					finishReason: 'STOP',
					content: {
						parts: [{ text: '[{"name":"A","size":"L","number":7,"artwork":null,"product":null}]' }]
					}
				}
			]
		},
		{ candidates: [] }
	]) {
		provider = async () => new Response(JSON.stringify(content));
		await assert.rejects(() => route.POST(event(paid)), { status: 502 });
	}
	provider = async () => new Response('secret provider body selfcheck-fake-key', { status: 403 });
	await assert.rejects(
		() => route.POST(event(paid)),
		(cause) => cause.status === 502 && !cause.body.message.includes('selfcheck-fake-key')
	);
	provider = async () => new Response('a'.repeat(2 * 1024 * 1024 + 1));
	await assert.rejects(() => route.POST(event(paid)), { status: 502 });
	const entered = Promise.withResolvers();
	provider = async (options) => {
		entered.resolve();
		return new Promise((_, reject) =>
			options.signal.addEventListener('abort', () => reject(new Error('aborted')))
		);
	};
	const cancellation = new AbortController();
	const pending = route.POST(event(paid, staff, cancellation.signal));
	await entered.promise;
	cancellation.abort();
	await assert.rejects(() => pending, { status: 499 });
	assert.equal(inserted, 0);
	assert.equal(
		await readFile(csvPath, 'utf8'),
		text,
		'Original source attachment must remain unchanged'
	);
	const saveEvent = (body) => ({
		locals: staff,
		params: { id: '45' },
		request: new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) })
	});
	for (const invalid of [
		{},
		{ orders: [] },
		{ orders: 'invalid' },
		{ orders: [{ ...local.orders[0], number: 7 }] },
		{ orders: local.orders, defaultProductId: '999' },
		{ orders: local.orders, filename: '../invalid.xlsx' }
	]) {
		await assert.rejects(() => save.POST(saveEvent(invalid)), { status: 400 });
	}
	assert.equal(inserted, 0);
	// Generate saves a draft directly: no approval, filename or arbitrary product selection is required.
	const proposal = {
		orders: local.orders.map((row, index) =>
			index === 0 ? { ...row, size: '', product: 'Krekls' } : row
		)
	};
	const saved = await save.POST(saveEvent(proposal));
	assert.equal(saved.status, 201);
	assert.equal(inserted, 2);
	const result = await saved.json();
	const firstPath = generatedPath;
	const firstBytes = await readFile(firstPath);
	const workbook = await readProductionWorkbook(firstBytes);
	assert.equal(result.fileId, 100);
	assert.equal(result.filename, 'production.xlsx');
	assert.deepEqual(result.workbook.orders, workbook.orders);
	assert.equal(workbook.setup.Draft, 'true');
	assert.equal(workbook.setup.DefaultProduct, '', 'Do not guess a production product');
	assert.equal(workbook.setup.TaskReference, '45');
	assert.equal(workbook.orders[0].number, '07');
	assert.equal(workbook.orders[0].name, 'BĒRZIŅŠ, JĀNIS');
	assert.equal(workbook.orders[0].size, '');
	assert.equal(
		workbook.orders[0].product,
		'Krekls',
		'Even an exact catalog name must remain unresolved rather than being matched silently'
	);
	assert.ok(workbook.warnings.some((warning) => warning.includes('size')));
	assert.ok(workbook.warnings.some((warning) => warning.includes('unresolved')));
	const formulaDraft = XLSX.read(Buffer.from(firstBytes));
	formulaDraft.Sheets.Orders.C2.f = '7';
	await assert.rejects(() => readProductionWorkbook(XLSX.write(formulaDraft, { type: 'buffer', bookType: 'xlsx' })));
	const badMarker = XLSX.read(Buffer.from(firstBytes));
	const markerRows = XLSX.utils.sheet_to_json(badMarker.Sheets.Setup, { header: 1 });
	badMarker.Sheets.Setup[`B${markerRows.findIndex((row) => row[0] === 'Draft') + 1}`].v = 'yes';
	await assert.rejects(() => readProductionWorkbook(XLSX.write(badMarker, { type: 'buffer', bookType: 'xlsx' })));
	const strict = XLSX.read(Buffer.from(firstBytes));
	const setupRows = XLSX.utils.sheet_to_json(strict.Sheets.Setup, { header: 1 });
	strict.Sheets.Setup[`B${setupRows.findIndex((row) => row[0] === 'Draft') + 1}`].v = 'false';
	await assert.rejects(() =>
		readProductionWorkbook(XLSX.write(strict, { type: 'buffer', bookType: 'xlsx' }))
	);
	catalog = [];
	const withoutCatalog = await save.POST(saveEvent({ orders: local.orders }));
	assert.equal(withoutCatalog.status, 201, 'Generating a list must not require production-library setup');
	assert.equal((await withoutCatalog.json()).workbook.setup.DefaultProduct, '');
	catalog = products;
	const ready = await save.POST(
		saveEvent({
			orders: local.orders.map((row, index) =>
				index === 0 ? { ...row, product: 'crm-production:20', artwork: 'Away' } : row
			),
			defaultProductId: '10'
		})
	);
	const secondResult = await ready.json();
	assert.notEqual(secondResult.id, result.id);
	assert.notEqual(secondResult.fileId, result.fileId);
	assert.notEqual(generatedPath, firstPath);
	assert.deepEqual(
		await readFile(firstPath),
		firstBytes,
		'Generating again must never replace an existing workbook'
	);
	assert.equal(secondResult.workbook.setup['Product.crm-production:20'], 'Šorti');
	assert.equal(secondResult.workbook.setup.DefaultProduct, 'crm-production:10');
	assert.equal(inserted, 6);
	assert.equal(await readFile(csvPath, 'utf8'), text);
	console.log(
		'Production parsing checks passed: no paid preview/local calls, task-scoped sources, explicit consent, exact source revisions, cancellation, strict provider output, protected secrets, automatic draft saving, editable incomplete rows and non-destructive regeneration.'
	);
} finally {
	globalThis.fetch = originalFetch;
	for (const path of paths) await rm(path, { force: true });
	await server.close();
	if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
	else process.env.GEMINI_API_KEY = oldKey;
	if (oldModel === undefined) delete process.env.GEMINI_MODEL;
	else process.env.GEMINI_MODEL = oldModel;
}
