import assert from 'node:assert/strict';
import { createServer } from 'vite';

// All database operations are mocked. No production data or schema is changed.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const helpers = await server.ssrLoadModule('/src/lib/server/production.ts');
	const route = await server.ssrLoadModule('/src/routes/(app)/razosana/+page.server.ts');
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	const sql = (condition) => dialect.sqlToQuery(condition);
	const staff = { user: { id: 'test-staff', type: 'admin' } };
	const form = (entries) => {
		const result = new FormData();
		for (const [key, value] of Object.entries(entries)) result.set(key, value);
		return result;
	};
	const event = (entries, locals = staff) => ({
		locals,
		request: { formData: async () => form(entries) }
	});
	const forbiddenQuery = () => {
		throw new Error('Unexpected database access');
	};
	db.select = db.insert = db.delete = db.transaction = forbiddenQuery;
	db.query.productionProduct.findFirst = forbiddenQuery;

	// Every read/action must enforce authorization itself, not depend on layout loading.
	for (const [locals, status] of [
		[{ user: null }, 401],
		[{ user: { type: 'client' } }, 403]
	]) {
		await assert.rejects(() => route.load({ locals, url: new URL('http://localhost/razosana') }), {
			status
		});
		for (const action of Object.values(route.actions))
			await assert.rejects(() => action(event({}, locals)), { status });
	}
	for (const input of ['', '0', '-1', '1.5', '1e2', ' 1', '01', '2147483648', '9'.repeat(50), null])
		assert.throws(() => helpers.productionId(input), { status: 400 });
	assert.equal(helpers.productionId('2147483647'), 2147483647);
	for (const name of ['', ' ', 'a'.repeat(121), 'bad\nname', 'bad\0name'])
		assert.equal((await route.actions.createProduct(event({ name }))).status, 400);
	for (const label of ['', ' ', 'a'.repeat(41), 'bad\tlabel'])
		assert.equal((await route.actions.addSize(event({ productId: '3', label }))).status, 400);
	assert.equal(
		(await route.actions.setBase(event({ productId: '3', sizeId: '8', isBase: 'yes' }))).status,
		400
	);

	let inserted;
	let createResult = [{ id: 3 }];
	db.insert = () => ({
		values: (value) => {
			inserted = value;
			return { onConflictDoNothing: () => ({ returning: async () => createResult }) };
		}
	});
	await assert.rejects(() => route.actions.createProduct(event({ name: '  Krekls Ā  ' })), {
		status: 303,
		location: '/razosana?product=3'
	});
	assert.deepEqual(inserted, { name: 'Krekls Ā' });
	createResult = [];
	assert.equal((await route.actions.createProduct(event({ name: 'Krekls Ā' }))).status, 409);

	db.select = () => ({ from: () => ({ orderBy: async () => [{ id: 3, name: 'Krekls' }] }) });
	db.query.productionProduct.findFirst = async () => ({
		id: 3,
		name: 'Krekls',
		sizes: [{ id: 8, label: 'L', isBase: true }]
	});
	assert.equal(
		(await route.load({ locals: staff, url: new URL('http://localhost/razosana') })).selectedProduct
			.sizes[0].label,
		'L'
	);
	await assert.rejects(
		() => route.load({ locals: staff, url: new URL('http://localhost/razosana?product=bad') }),
		{ status: 400 }
	);
	db.query.productionProduct.findFirst = async () => undefined;
	await assert.rejects(
		() => route.load({ locals: staff, url: new URL('http://localhost/razosana?product=3') }),
		{ status: 404 }
	);

	let parentExists = true;
	let sizeExists = true;
	let sizeCreated = true;
	let updates = [];
	let deletes = [];
	let locks = [];
	db.transaction = async (callback) =>
		callback({
			select: () => ({
				from: () => ({
					where: (condition) => ({
						for: async (mode) => {
							locks.push({ mode, ...sql(condition) });
							return parentExists ? [{ id: 3 }] : [];
						},
						then: (resolve) => resolve(sizeExists ? [{ id: 8 }] : [])
					})
				})
			}),
			insert: () => ({
				values: (value) => {
					inserted = value;
					return {
						onConflictDoNothing: () => ({ returning: async () => (sizeCreated ? [{ id: 8 }] : []) })
					};
				}
			}),
			update: () => ({
				set: (value) => ({
					where: async (condition) => {
						updates.push({ value, ...sql(condition) });
					}
				})
			}),
			delete: () => ({
				where: async (condition) => {
					deletes.push(sql(condition));
				}
			})
		});
	assert.equal(
		(await route.actions.addSize(event({ productId: '3', label: '  XL  ' }))).success,
		true
	);
	assert.deepEqual(inserted, { productId: 3, label: 'XL' });
	sizeCreated = false;
	assert.equal((await route.actions.addSize(event({ productId: '3', label: 'XL' }))).status, 409);
	assert.equal(
		(await route.actions.setBase(event({ productId: '3', sizeId: '8', isBase: 'true' }))).success,
		true
	);
	assert.deepEqual(
		updates.map((update) => update.value),
		[{ isBase: false }, { isBase: true }]
	);
	assert.deepEqual(updates[0].params, [3]);
	assert.deepEqual(updates[1].params, [3, 8]);
	assert.ok(locks.every((lock) => lock.mode === 'update' && lock.params[0] === 3));
	updates = [];
	assert.equal(
		(await route.actions.setBase(event({ productId: '3', sizeId: '8', isBase: 'false' }))).success,
		true
	);
	assert.deepEqual(
		updates.map((update) => update.value),
		[{ isBase: false }]
	);
	updates = [];
	sizeExists = false;
	assert.equal(
		(await route.actions.setBase(event({ productId: '3', sizeId: '999', isBase: 'true' }))).status,
		404
	);
	assert.deepEqual(updates, [], 'A foreign/missing size must not clear the current base');
	assert.equal(
		(await route.actions.deleteSize(event({ productId: '3', sizeId: '999' }))).status,
		404
	);
	assert.equal(deletes.length, 0);
	sizeExists = true;
	assert.equal(
		(await route.actions.deleteSize(event({ productId: '3', sizeId: '8' }))).success,
		true
	);
	assert.deepEqual(deletes[0].params, [3, 8]);
	parentExists = false;
	assert.equal((await route.actions.addSize(event({ productId: '3', label: 'M' }))).status, 404);

	db.delete = () => ({ where: () => ({ returning: async () => [{ id: 3 }] }) });
	await assert.rejects(() => route.actions.deleteProduct(event({ productId: '3' })), {
		status: 303,
		location: '/razosana'
	});
	db.delete = () => ({ where: () => ({ returning: async () => [] }) });
	assert.equal((await route.actions.deleteProduct(event({ productId: '3' }))).status, 404);

	// Unknown database errors are not exposed to users, and submitted edits stay in the browser.
	const originalError = console.error;
	try {
		console.error = () => {};
		db.insert = () => {
			throw new Error('secret connection details');
		};
		const failed = await route.actions.createProduct(event({ name: 'Krekls' }));
		assert.equal(failed.status, 500);
		assert.ok(!failed.data.message.includes('secret'));
	} finally {
		console.error = originalError;
	}
	console.log(
		'Production library checks passed: authorization, validation, selection, CRUD, scoped size writes, base switching and safe errors.'
	);
} finally {
	await server.close();
}
