import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { inArray } from 'drizzle-orm';

// Mocked DB only. No live customer records or mutations; run only when authorized.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const { safeUserColumns } = await server.ssrLoadModule('/src/lib/server/auth.ts');
	const schema = await server.ssrLoadModule('/src/lib/server/db/schema.ts');
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	assert.deepEqual(Object.keys(safeUserColumns).sort(), ['email', 'id', 'name', 'type']);
	const secret = 'PASSWORD-HASH-MUST-NOT-LEAK';
	const user = {
		id: 'fixture-staff',
		name: 'Staff',
		email: 'staff@example.invalid',
		type: 'admin',
		password: secret
	};
	const meta = { id: 12, clientId: 4, createdById: 'fixture-client' };
	db.query.userClient.findMany = async () => [{ clientId: 4 }];
	let projections = 0;
	db.query.task.findFirst = async (query) => {
		if (query.columns) return meta;
		const columns = query.with?.assignees?.with?.user?.columns;
		assert.deepEqual(columns, safeUserColumns, 'Nested users must explicitly select safe columns');
		projections++;
		const selected = Object.fromEntries(Object.entries(user).filter(([key]) => columns[key]));
		return {
			...meta,
			files: [],
			history: [],
			taskMaterials: [],
			taskProducts: [],
			assignees: [{ userId: user.id, user: selected }]
		};
	};
	for (const table of ['client', 'user', 'material', 'product', 'invoice', 'productionProject'])
		db.query[table].findMany = async () => [];
	let expectedClient = null;
	const checkScope = (where, table) => {
		const condition = where(table, { inArray });
		if (expectedClient === null) assert.equal(condition, undefined);
		else assert.deepEqual(dialect.sqlToQuery(condition).params, [expectedClient]);
	};
	db.query.client.findMany = async (query) => {
		checkScope(query.where, schema.client);
		return [];
	};
	db.query.product.findMany = async (query) => {
		checkScope(query.with.clientPrices.where, schema.clientProductPrice);
		return [];
	};
	db.select = () => ({ from: () => ({ where: () => ({ limit: async () => [{ clientId: 4 }] }) }) });
	for (const path of [
		'/src/routes/(app)/projekti/skatit/[id]/+page.server.ts',
		'/src/routes/(app)/projekti/labot/[id]/+page.server.ts',
		'/src/routes/(app)/pabeigtie/[id]/+page.server.ts'
	]) {
		const page = await server.ssrLoadModule(path);
		for (const account of [user, { id: 'fixture-client', type: 'client' }]) {
			expectedClient = account.type === 'client' ? 4 : null;
			const result = await page.load({ params: { id: '12' }, locals: { user: account } });
			assert.equal(result.item.assignees[0].user.name, 'Staff');
			assert.ok(!JSON.stringify(result).includes(secret));
			assert.equal(Object.hasOwn(result.item.assignees[0].user, 'password'), false);
		}
	}
	meta.clientId = null;
	expectedClient = 4;
	const draftPage = await server.ssrLoadModule(
		'/src/routes/(app)/projekti/labot/[id]/+page.server.ts'
	);
	const draft = await draftPage.load({
		params: { id: '12' },
		locals: { user: { id: 'fixture-client', type: 'client' } }
	});
	assert.equal(
		draft.userClientId,
		null,
		'Unassigned draft estimates must not silently use another customer'
	);
	assert.equal(projections, 7);
	console.log(
		'Task user data checks passed: explicit safe projections for active/edit/completed pages, staff and clients. No live DB calls.'
	);
} finally {
	await server.close();
}
