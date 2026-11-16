import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

// Offline only: replace every DB operation before invoking an endpoint. No paid requests.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const auth = await server.ssrLoadModule('/src/lib/server/print-tools/auth.ts');
	const validation = await server.ssrLoadModule('/src/lib/server/print-tools/validation.ts');
	const { limitCrmRequest } = await server.ssrLoadModule('/src/lib/server/request-size.ts');
	const api = await server.ssrLoadModule('/src/routes/api/print-tools/[...path]/+server.ts');
	const library = await server.ssrLoadModule('/src/lib/server/print-tools/library.ts');
	const ai = await server.ssrLoadModule('/src/lib/server/print-tools/ai.ts');
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	const staff = { user: { id: 'fixture-staff', type: 'admin' } };
	const noDb = () => {
		throw new Error('Unexpected database access');
	};
	db.select = db.insert = db.delete = db.transaction = noDb;
	const request = (key, method = 'GET', path = 'health', body) =>
		new Request(`https://crm.invalid/api/print-tools/${path}`, {
			method,
			headers: {
				...(key ? { 'X-Api-Key': key } : {}),
				...(body ? { 'Content-Type': 'application/json' } : {})
			},
			...(body ? { body: JSON.stringify(body) } : {})
		});
	for (const key of ['', 'old-shared-key', `pt_${'z'.repeat(64)}`]) {
		const req = request(key);
		assert.equal((await api.GET({ request: req, url: new URL(req.url) })).status, 401);
	}
	for (const locals of [{ user: null }, { user: { id: 'client', type: 'client' } }]) {
		await assert.rejects(() => auth.createPrintToolsToken(locals), {
			status: locals.user ? 403 : 401
		});
		await assert.rejects(() => auth.listPrintToolsTokens(locals), {
			status: locals.user ? 403 : 401
		});
		await assert.rejects(() => auth.revokePrintToolsToken(locals, '1'), {
			status: locals.user ? 403 : 401
		});
	}
	const token = `pt_${'a'.repeat(64)}`;
	let owner = [{ id: staff.user.id }],
		predicate;
	db.select = () => ({
		from: () => ({
			innerJoin: () => ({
				where: async (where) => {
					predicate = dialect.sqlToQuery(where);
					return owner;
				}
			})
		})
	});
	assert.deepEqual(await auth.authenticatePrintTools(request(token)), owner[0]);
	assert.ok(predicate.params.includes(createHash('sha256').update(token).digest('hex')));
	assert.ok(predicate.params.includes('admin'));
	assert.match(predicate.sql, /expires_at/);
	assert.ok(!predicate.params.includes(token));
	const req = request(token);
	const health = await api.GET({ request: req, url: new URL(req.url) });
	assert.equal(health.headers.get('cache-control'), 'no-store');
	assert.equal((await health.json()).backend, 'crm-print-tools');
	owner = [];
	await assert.rejects(() => auth.authenticatePrintTools(request(token)), { status: 401 });

	await assert.rejects(
		() =>
			ai.aiRoute('POST', ['orders', 'parse'], { paidConsent: false }, new AbortController().signal),
		{ status: 400 }
	);
	db.query.geminiSettings.findFirst = async () => ({
		apiKey: 'fake-offline-key',
		model: 'gemini-test'
	});
	await assert.rejects(
		() =>
			ai.aiRoute(
				'POST',
				['orders', 'parse'],
				{ paidConsent: true, aiRevision: 'stale' },
				new AbortController().signal
			),
		{ status: 409 }
	);

	let stored;
	db.transaction = async (callback) =>
		callback({
			select: () => ({
				from: () => ({
					where: () => ({
						for: async () => [{ id: staff.user.id }],
						then: (resolve) => resolve([])
					})
				})
			}),
			insert: () => ({
				values: async (value) => {
					stored = value;
				}
			})
		});
	const issued = await auth.createPrintToolsToken(staff);
	assert.match(issued, /^pt_[a-f0-9]{64}$/);
	assert.equal(stored.userId, staff.user.id);
	assert.equal(stored.tokenHash, createHash('sha256').update(issued).digest('hex'));
	assert.ok(!JSON.stringify(stored).includes(issued));
	assert.ok(stored.expiresAt > new Date());
	let revoked;
	db.delete = () => ({
		where: async (where) => {
			revoked = dialect.sqlToQuery(where);
		}
	});
	await auth.revokePrintToolsToken(staff, '8');
	assert.deepEqual(revoked.params, [8, staff.user.id]);

	assert.throws(
		() =>
			limitCrmRequest(
				new Request('https://crm.invalid/upload', {
					method: 'POST',
					headers: { 'Content-Length': String(26 * 1024 * 1024 + 1) },
					body: 'x'
				})
			),
		{ status: 413 }
	);
	const chunked = new Request('https://crm.invalid/upload', {
		method: 'POST',
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(27 * 1024 * 1024));
				controller.close();
			}
		}),
		duplex: 'half'
	});
	await assert.rejects(() => limitCrmRequest(chunked).arrayBuffer(), { status: 413 });
	assert.equal(
		await limitCrmRequest(
			new Request('https://crm.invalid/upload', { method: 'POST', body: 'small' })
		).text(),
		'small'
	);

	const body = new Request('https://crm.invalid', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{"name":"Krekls"}'
	});
	assert.equal((await validation.readPrintToolsBody(body)).name, 'Krekls');
	await assert.rejects(
		() =>
			validation.readPrintToolsBody(
				new Request('https://crm.invalid', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: '"not an object"'
				})
			),
		{ status: 400 }
	);
	await assert.rejects(
		() =>
			validation.readPrintToolsBody(
				new Request('https://crm.invalid', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: '{"text":"too large"}'
				}),
				4
			),
		{ status: 413 }
	);
	for (const value of ['', 'cdr|legacy', 'cdrfile|legacy', '<svg/>', 'cdrole|!!!!|AA==|'])
		assert.throws(() => validation.nativeCapture(value), { status: 400 });
	const storage = Buffer.alloc(512);
	Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(storage);
	const descriptor = Buffer.alloc(52);
	descriptor.writeUInt32LE(52, 0);
	descriptor.writeUInt32LE(1, 20);
	const envelope = `cdrole|${storage.toString('base64')}|${descriptor.toString('base64')}|`;
	assert.equal(
		validation.nativeCapture(envelope),
		envelope,
		'Envelope bytes must stay opaque/unchanged; the plugin validates actual OLE storage before paste'
	);
	descriptor.writeUInt32LE(53, 44);
	assert.throws(
		() =>
			validation.nativeCapture(
				`cdrole|${storage.toString('base64')}|${descriptor.toString('base64')}|`
			),
		{ status: 400 }
	);

	db.select = () => ({ from: () => ({ orderBy: async () => [{ id: 3, name: 'Krekls' }] }) });
	assert.deepEqual(
		await (await library.libraryRoute('GET', ['products'], new URLSearchParams(), {})).json(),
		[{ id: 3, name: 'Krekls' }]
	);
	let product;
	db.insert = () => ({
		values: (value) => {
			product = value;
			return { onConflictDoNothing: () => ({ returning: async () => [{ id: 3, ...value }] }) };
		}
	});
	assert.equal(
		(await library.libraryRoute('POST', ['products'], new URLSearchParams(), { name: ' Krekls ' }))
			.status,
		201
	);
	assert.deepEqual(product, { name: 'Krekls' });
	await assert.rejects(
		() => library.libraryRoute('POST', ['products'], new URLSearchParams(), { name: 'bad\nname' }),
		{ status: 400 }
	);
	console.log(
		'Print Tools API checks passed: scoped hashed credentials/revocation, no legacy key, request/native bounds and product response compatibility. No real DB/Google calls.'
	);
} finally {
	await server.close();
}
