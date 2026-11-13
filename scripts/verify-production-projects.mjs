import assert from 'node:assert/strict';
import { readFile, writeFile, rm, stat, utimes, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getTableName } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { createServer } from 'vite';

// Real handlers and unique temporary files, with every database operation mocked.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const paths = new Set();
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	const query = (where) => dialect.sqlToQuery(where);
	const helpers = await server.ssrLoadModule('/src/lib/server/documents.ts');
	const { readProductionWorkbook } = await server.ssrLoadModule(
		'/src/lib/server/production-workbook.ts'
	);
	const listing = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-projects/+server.ts'
	);
	const detail = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-projects/[project]/+server.ts'
	);
	const previous = await server.ssrLoadModule(
		'/src/routes/api/tasks/[id]/production-projects/[project]/previous/+server.ts'
	);
	const office = await server.ssrLoadModule('/src/routes/(app)/dokumenti/[id]/+page.server.ts');
	const uploads = await server.ssrLoadModule('/src/routes/uploads/[...path]/+server.ts');
	const remove = await server.ssrLoadModule('/src/routes/api/remove/+server.ts');
	const taskfiles = await server.ssrLoadModule('/src/routes/api/taskfiles/+server.ts');
	const fileManager = await server.ssrLoadModule('/src/routes/(app)/faili/+page.server.ts');
	const completion = await server.ssrLoadModule(
		'/src/routes/(app)/projekti/pabeigt/[id]/+page.server.ts'
	);
	const deletion = await server.ssrLoadModule(
		'/src/routes/(app)/projekti/izdzest/[id]/+page.server.ts'
	);
	const archiveDeletion = await server.ssrLoadModule(
		'/src/routes/(app)/pabeigtie/izdzest/[id]/+page.server.ts'
	);
	const { assertTaskAccess } = await server.ssrLoadModule('/src/lib/server/task-access.ts');
	const migration = await readFile(
		new URL('../drizzle/0038_lucky_iron_monger.sql', import.meta.url),
		'utf8'
	);
	assert.ok(
		migration.indexOf('ALTER TABLE "files" ADD CONSTRAINT "files_id_task_id_unique"') <
			migration.indexOf('REFERENCES "public"."files"'),
		'The supporting unique constraint must precede the composite foreign key'
	);
	const fixture = await readFile(new URL('../docs/fixtures/production-v1.xlsx', import.meta.url));
	assert.equal((await readProductionWorkbook(fixture)).orders[0].number, '07');
	const write = (book) => XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
	for (const mutate of [
		(book) => (book.Sheets.Orders.C2 = { t: 'n', v: 7 }),
		(book) => (book.Sheets.Orders.C2.f = '7'),
		(book) => (book.Sheets.Orders.B2.v = ''),
		(book) => (book.Sheets.Orders.D2.v = ''),
		(book) => (book.Sheets.Setup.B2.v = '2'),
		(book) => (book.Sheets.Setup.B3.v = 'NaN'),
		(book) => (book.Sheets.Setup.B7.v = '101'),
		(book) => (book.Sheets.Setup.B15.v = 'wrong-material'),
		(book) => (book.Sheets.Orders.A1.v = 'Changed'),
		(book) => (book.Sheets.Orders['!ref'] = 'A1:E10002'),
		(book) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Extra']]), 'Extra')
	]) {
		const book = XLSX.read(Buffer.from(fixture));
		mutate(book);
		await assert.rejects(() => readProductionWorkbook(write(book)));
	}
	await assert.rejects(() => readProductionWorkbook(Buffer.from('not XLSX')));
	for (const [name, content] of [
		['xl/vbaProject.bin', 'macro'],
		['xl/oversized.bin', Buffer.alloc(17 * 1024 * 1024)],
		['xl/externalLinks/link.xml', '<link/>'],
		['xl/test.xml', '<!DOCTYPE test><test/>']
	]) {
		const archive = await JSZip.loadAsync(fixture);
		archive.file(name, content);
		await assert.rejects(async () => readProductionWorkbook(await awaitBuffer(archive)));
	}
	async function awaitBuffer(archive) {
		return archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
	}

	const records = new Map();
	const references = new Map();
	let nextId = 1000;
	let failInsert = false;
	let failMetadata = false;
	let deleteCondition;
	const task = { id: 45, clientId: 7, createdById: 'owner', preview: null, files: [], tabId: 1 };
	db.query.task.findFirst = async ({ where }) => {
		const id = query(where).params[0];
		return id === 45 ? task : id === 46 ? { ...task, id: 46 } : undefined;
	};
	db.query.taskAssignee.findFirst = async () => undefined;
	db.query.userClient.findFirst = async () => undefined;
	db.query.file.findFirst = async ({ where }) => records.get(query(where).params[0]);
	db.query.productionProject.findFirst = async ({ where }) => {
		const { sql, params } = query(where);
		return [...references.values()].find((project) =>
			sql.includes('"file_id"')
				? project.fileId === params[0]
				: params.length > 1
					? project.taskId === params[0] && project.id === params[1]
					: project.taskId === params[0]
		);
	};
	db.query.productionProject.findMany = async ({ where }) =>
		[...references.values()].filter((project) => project.taskId === query(where).params[0]);
	db.transaction = async (callback) => {
		const beforeRecords = new Map(records);
		const beforeReferences = new Map(references);
		try {
			return await callback({
				select: () => ({
					from: () => ({
						where: () => ({
							for: async (mode) => {
								assert.equal(mode, 'update');
								return [{ id: 45 }];
							}
						})
					})
				}),
				insert: (table) => ({
					values: (value) => ({
						returning: async () => {
							if (getTableName(table) === 'files') {
								const record = { ...value, id: ++nextId };
								records.set(record.id, record);
								paths.add(`uploads/${value.downloadUrl.slice('/uploads/'.length)}`);
								return [record];
							}
							if (failInsert) throw new Error('simulated project insert failure');
							const project = { ...value, id: ++nextId };
							references.set(project.id, project);
							return [project];
						}
					})
				})
			});
		} catch (cause) {
			records.clear();
			references.clear();
			for (const [id, value] of beforeRecords) records.set(id, value);
			for (const [id, value] of beforeReferences) references.set(id, value);
			throw cause;
		}
	};
	db.update = (table) => ({
		set: (value) => ({
			where: async (condition) => {
				if (getTableName(table) === 'files') {
					if (failMetadata) throw new Error('simulated metadata failure');
					Object.assign(records.get(query(condition).params[0]), value);
				} else Object.assign(task, value);
			}
		})
	});
	db.delete = () => ({
		where: async (condition) => {
			deleteCondition = query(condition);
		}
	});
	const staff = { user: { id: 'staff', type: 'admin' } };
	const event = (data = {}, locals = staff, params = { id: '45', project: '0' }) => {
		const form = new FormData();
		for (const [key, value] of Object.entries(data)) form.set(key, value);
		return {
			locals,
			params,
			request: { formData: async () => form },
			url: new URL('http://localhost/api/test')
		};
	};
	for (const [locals, status] of [
		[{ user: null }, 401],
		[{ user: { id: 'owner', type: 'client' } }, 403]
	])
		for (const handler of [
			listing.GET,
			listing.POST,
			detail.GET,
			detail.POST,
			previous.GET,
			previous.POST
		])
			await assert.rejects(() => handler(event({}, locals)), { status });
	await assertTaskAccess({ user: { id: 'owner', type: 'client' } }, 45);
	await assert.rejects(() => assertTaskAccess({ user: { id: 'stranger', type: 'client' } }, 45), {
		status: 403
	});
	db.query.userClient.findFirst = async () => ({ clientId: 7 });
	await assertTaskAccess({ user: { id: 'linked-client', type: 'client' } }, 45);
	db.query.userClient.findFirst = async () => undefined;
	db.query.taskAssignee.findFirst = async () => ({ userId: 'assigned-client' });
	await assertTaskAccess({ user: { id: 'assigned-client', type: 'client' } }, 45);
	db.query.taskAssignee.findFirst = async () => undefined;

	const file = new File([fixture], 'production.xlsx');
	failInsert = true;
	await assert.rejects(() => listing.POST(event({ file })), /simulated/);
	assert.equal(records.size, 0);
	for (const path of paths) await assert.rejects(() => stat(path), { code: 'ENOENT' });
	failInsert = false;
	const createdResponse = await listing.POST(event({ file }));
	assert.equal(createdResponse.status, 201);
	const created = await createdResponse.json();
	const params = { id: '45', project: String(created.id) };
	const record = records.get(created.fileId);
	const path = `uploads/${record.downloadUrl.slice('/uploads/'.length)}`;
	paths.add(`${path}.previous`);
	assert.equal(references.size, 1);
	assert.equal((await (await listing.GET(event())).json()).projects.length, 1);
	// The ordinary upload endpoint cannot designate a workbook by its filename.
	db.insert = () => ({
		values: (value) => ({
			returning: async () => {
				const ordinary = { ...value, id: ++nextId };
				records.set(ordinary.id, ordinary);
				paths.add(`uploads/${value.downloadUrl.slice('/uploads/'.length)}`);
				return [ordinary];
			}
		})
	});
	const ordinaryUpload = await (await taskfiles.POST(event({ file, taskId: '45' }))).json();
	assert.equal(ordinaryUpload.success, true);
	assert.equal((await helpers.loadDocument(String(ordinaryUpload.fileId))).projectId, null);
	assert.equal((await (await listing.GET(event())).json()).projects.length, 1);
	await assert.rejects(() => detail.GET(event({}, staff, { ...params, id: '46' })), {
		status: 404
	});
	assert.equal(
		(await (await detail.GET(event({}, staff, params))).json()).workbook.orders[0].number,
		'07'
	);
	await assert.rejects(() => previous.GET(event({}, staff, params)), { status: 404 });
	const download = event({}, staff, params);
	download.url.searchParams.set('download', '1');
	assert.deepEqual(Buffer.from(await (await detail.GET(download)).arrayBuffer()), fixture);
	const publicEvent = {
		params: { path: record.downloadUrl.slice('/uploads/'.length) },
		request: new Request('http://localhost'),
		url: new URL('http://localhost')
	};
	assert.equal((await uploads.GET(publicEvent)).status, 404);
	assert.equal(
		(await uploads.GET({ ...publicEvent, params: { path: `${publicEvent.params.path}.previous` } }))
			.status,
		404
	);
	await assert.rejects(() => helpers.loadDocument(`fs:${publicEvent.params.path}`), {
		status: 404
	});
	await assert.rejects(
		() =>
			remove.POST({ locals: staff, request: { json: async () => ({ path: record.downloadUrl }) } }),
		{ status: 409 }
	);
	const originalSelect = db.select;
	db.select = () => ({ from: () => ({ where: async () => [record] }) });
	assert.equal(
		(
			await taskfiles.DELETE({
				locals: staff,
				request: { json: async () => ({ fileId: record.id }) }
			})
		).status,
		409
	);
	db.select = originalSelect;
	await assert.rejects(
		() =>
			fileManager.actions.delete(
				event({ filename: `production/${path.split('/').at(-1)}`, dbId: String(record.id) })
			),
		{ status: 409 }
	);
	for (const handler of [deletion.actions.default, archiveDeletion.actions.default])
		await assert.rejects(() => handler(event({}, staff, { id: '45' })), { status: 409 });
	assert.deepEqual(await readFile(path), fixture);

	const book = XLSX.read(Buffer.from(fixture));
	book.Sheets.Orders.A2.v = 'JAUNS PASŪTĪJUMS';
	const edited = write(book);
	const result = await detail.POST(
		event(
			{ file: new File([edited], 'production.xlsx'), revision: created.revision },
			staff,
			params
		)
	);
	const saved = await result.json();
	assert.notEqual(saved.revision, created.revision);
	assert.deepEqual(await readFile(`${path}.previous`), fixture);
	assert.deepEqual(
		Buffer.from(await (await previous.GET(event({}, staff, params))).arrayBuffer()),
		fixture
	);
	await assert.rejects(
		() => detail.POST(event({ file, revision: created.revision }, staff, params)),
		{ status: 409 }
	);
	assert.deepEqual(await readFile(path), edited);
	await assert.rejects(
		() =>
			detail.POST(
				event(
					{ file: new File(['invalid'], 'production.xlsx'), revision: saved.revision },
					staff,
					params
				)
			),
		{ status: 400 }
	);
	await writeFile(`${path}.lock`, 'another writer');
	paths.add(`${path}.lock`);
	await assert.rejects(
		() => detail.POST(event({ file, revision: saved.revision }, staff, params)),
		{ status: 409 }
	);
	await rm(`${path}.lock`);
	failMetadata = true;
	await assert.rejects(
		() => detail.POST(event({ file, revision: saved.revision }, staff, params)),
		/metadata failure/
	);
	assert.deepEqual(await readFile(path), edited, 'Metadata failure must restore the current file');
	assert.deepEqual(
		await readFile(`${path}.previous`),
		fixture,
		'Failed saves must not replace the previous successful copy'
	);
	failMetadata = false;
	// If promoting the recovery file fails after metadata update, restore both bytes and size.
	await rm(`${path}.previous`);
	await mkdir(`${path}.previous`);
	try {
		await assert.rejects(() =>
			detail.POST(event({ file, revision: saved.revision }, staff, params))
		);
		assert.deepEqual(await readFile(path), edited);
		assert.equal(records.get(record.id).size, edited.length);
	} finally {
		await rm(`${path}.previous`, { recursive: true, force: true });
		await writeFile(`${path}.previous`, fixture);
	}

	// Office Save uses the very same production validation, lock and backup mechanism.
	const officeEvent = event({ file, revision: saved.revision }, staff, { id: String(record.id) });
	assert.equal((await office.actions.save(officeEvent)).success, true);
	assert.deepEqual(await readFile(`${path}.previous`), edited);
	assert.equal(
		(
			await office.actions.save(
				event(
					{ file: new File(['invalid'], 'production.xlsx'), revision: created.revision },
					staff,
					{ id: String(record.id) }
				)
			)
		).status,
		400
	);
	const recovered = await previous.POST(event({ revision: created.revision }, staff, params));
	assert.equal((await recovered.json()).success, true);
	assert.deepEqual(await readFile(path), edited);
	assert.deepEqual(await readFile(`${path}.previous`), fixture);

	const before = await helpers.loadDocument(String(record.id));
	const sameLength = Buffer.from(edited);
	sameLength[sameLength.length - 1] ^= 1;
	await writeFile(path, sameLength);
	await utimes(path, before.mtime, before.mtime);
	assert.notEqual(
		(await helpers.loadDocument(String(record.id))).revision,
		before.revision,
		'Same size/mtime edits must change the revision'
	);
	await writeFile(path, edited);

	const ordinaryPath = `uploads/workbook-selfcheck-${randomUUID()}.txt`;
	paths.add(ordinaryPath);
	await writeFile(ordinaryPath, 'temporary ordinary attachment');
	task.files = [record, { id: 99, downloadUrl: `/${ordinaryPath}` }];
	await assert.rejects(() => completion.actions.default(event({}, staff, { id: '45' })), {
		status: 303
	});
	assert.equal(task.isDone, true);
	await assert.rejects(() => stat(ordinaryPath), { code: 'ENOENT' });
	assert.deepEqual(await readFile(path), edited);
	assert.deepEqual(await readFile(`${path}.previous`), fixture);
	assert.ok(
		deleteCondition.sql.includes('not in') && deleteCondition.sql.includes('production_projects'),
		'Completion DB deletion must exclude designated files'
	);
	console.log(
		'Production project checks passed: bounded workbook validation, authorization, create rollback, scoped identity, private storage, safe office/API saves, conflicts, recovery and completion retention.'
	);
} finally {
	for (const path of paths) await rm(path, { force: true });
	await server.close();
}
