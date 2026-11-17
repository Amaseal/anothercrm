import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getTableName } from 'drizzle-orm';
import { createServer } from 'vite';

// Focused offline checks; DB calls are mocked before invoking handlers. No live writes.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	const access = await server.ssrLoadModule('/src/lib/server/task-access.ts');
	const { PgDialect } = await server.ssrLoadModule('/node_modules/drizzle-orm/pg-core/index.js');
	const dialect = new PgDialect();
	const alice = { id: 'alice', type: 'client' };
	const staff = { id: 'staff', type: 'admin' };
	let item = { id: 11, clientId: 8, createdById: 'alice' };
	let links = [{ clientId: 7 }];
	db.query.task.findFirst = async () => item;
	db.query.userClient.findMany = async () => links;
	db.query.taskAssignee.findFirst = async () => {
		throw new Error('Assignment must not grant client access');
	};
	let writes = 0;
	for (const method of ['insert', 'update', 'delete'])
		db[method] = () => {
			writes++;
			throw new Error('Unexpected database mutation');
		};

	assert.equal(
		access.canAccessTask(alice, item, [7]),
		false,
		'Creator cannot cross client boundaries'
	);
	assert.equal(access.canAccessTask(staff, item, []), true, 'Unassigned staff retain access');
	await assert.rejects(() => access.assertTaskAccess({ user: alice }, 11), { status: 403 });
	await access.assertTaskAccess({ user: staff }, 11);
	await assert.rejects(() => access.assertClientAccess({ user: alice }, 8), { status: 403 });
	await assert.rejects(() => access.assertClientAccess({ user: alice }, NaN), { status: 400 });
	await access.assertClientAccess({ user: alice }, 7);
	await access.assertClientAccess({ user: alice }, null);
	for (const id of [0, -1, NaN, 1.5, 2_147_483_648])
		await assert.rejects(() => access.assertTaskAccess({ user: alice }, id), { status: 404 });
	await assert.rejects(() => access.assertTaskAccess({ user: null }, 11), { status: 401 });
	item = { ...item, clientId: null };
	await access.assertTaskAccess({ user: alice }, 11);
	item = { ...item, createdById: 'other' };
	await assert.rejects(() => access.assertTaskAccess({ user: alice }, 11), { status: 403 });
	item = { ...item, clientId: 7 };
	await access.assertTaskAccess({ user: alice }, 11);
	links = [];
	await assert.rejects(() => access.assertTaskAccess({ user: alice }, 11), { status: 403 });
	links = [{ clientId: 7 }];
	const condition = dialect.sqlToQuery(access.clientTaskCondition(alice.id, [7]));
	assert.match(condition.sql, /"client_id" is null/);
	assert.ok(!condition.sql.includes('task_assignees'));
	assert.deepEqual(condition.params, ['alice', 7]);

	// All these handlers must reject before writes, locks, disk operations or mail.
	item = { id: 11, clientId: 8, createdById: 'alice' };
	const moves = await server.ssrLoadModule('/src/routes/api/tasks/move/+server.ts');
	const sessions = await server.ssrLoadModule('/src/routes/api/tasks/[id]/session/+server.ts');
	const taskfiles = await server.ssrLoadModule('/src/routes/api/taskfiles/+server.ts');
	const path = `/uploads/security-fixture-${randomUUID()}.txt`;
	db.select = () => ({
		from: () => ({ where: async () => [{ id: 22, taskId: 11, downloadUrl: path }] })
	});
	const event = {
		locals: { user: alice },
		params: { id: '11' },
		url: new URL('http://localhost/api/taskfiles?id=22'),
		request: {
			json: async () => ({ taskId: 11, targetTabId: 2, fileId: 22, filePath: path }),
			formData: async () => ({
				get: (key) =>
					key === 'taskId'
						? '11'
						: {
								get name() {
									throw new Error('File accessed before authorization');
								}
							}
			})
		}
	};
	for (const handler of [
		moves.POST,
		sessions.GET,
		sessions.POST,
		sessions.DELETE,
		taskfiles.GET,
		taskfiles.POST,
		taskfiles.DELETE
	])
		await assert.rejects(() => handler(event), { status: 403 });

	db.query.settings.findFirst = async () => ({
		nextcloud_username: 'fixture',
		nextcloud_password: 'not-a-real-password',
		nextcloud: 'https://example.invalid'
	});
	const share = await server.ssrLoadModule('/src/routes/api/nextcloud/share-project/+server.ts');
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = async () => {
			throw new Error('Network calls are forbidden in this check');
		};
		await assert.rejects(
			() =>
				share.POST({
					...event,
					request: { json: async () => ({ taskId: 11, conversationToken: 'fixture' }) }
				}),
			{ status: 403 }
		);
	} finally {
		globalThis.fetch = originalFetch;
	}

	for (const path of [
		'/src/routes/(app)/produkti/pievienot/+page.server.ts',
		'/src/routes/(app)/produkti/labot/[id]/+page.server.ts',
		'/src/routes/(app)/produkti/izdzest/[id]/+page.server.ts',
		'/src/routes/(app)/klienti/pievienot/+page.server.ts',
		'/src/routes/(app)/klienti/saplust/+page.server.ts'
	]) {
		const page = await server.ssrLoadModule(path);
		for (const [user, status] of [
			[alice, 403],
			[null, 401]
		]) {
			await assert.rejects(() => page.load({ locals: { user } }), { status });
			await assert.rejects(() => page.actions.default({ locals: { user } }), { status });
		}
	}
	const clients = await server.ssrLoadModule('/src/routes/api/clients/+server.ts');
	await assert.rejects(() => clients.POST(event), { status: 403 });
	const clientPage = await server.ssrLoadModule('/src/routes/(app)/klienti/[id]/+page.server.ts');
	await assert.rejects(() => clientPage.load({ locals: { user: alice }, params: { id: '8' } }), {
		status: 403
	});
	assert.equal(writes, 0);

	// Forged office fields cannot change staff assignments/materials or custom pricing.
	item = {
		id: 11,
		clientId: 7,
		createdById: 'other',
		title: 'Task',
		seamstress: 'Retained',
		price: 160,
		endDate: '2026-01-02',
		assignees: [{ userId: 'staff' }],
		taskMaterials: [{ materialId: 3 }],
		taskProducts: []
	};
	links = [{ clientId: 9 }, { clientId: 7 }];
	let saved;
	const inserts = new Map();
	db.update = () => ({
		set: (value) => ({
			where: async () => {
				saved = value;
			}
		})
	});
	db.delete = () => ({ where: async () => {} });
	db.insert = (table) => ({
		values: async (value) => {
			inserts.set(getTableName(table), value);
		}
	});
	db.query.product.findMany = async () => [
		{
			id: 5,
			price: 100,
			clientPrices: [
				{ clientId: 7, price: 80 },
				{ clientId: 9, price: 1 }
			]
		}
	];
	const form = new FormData();
	for (const [key, value] of Object.entries({
		title: 'Renamed',
		description: '',
		clientId: '7',
		assignedToUserIds: 'attacker',
		seamstress: 'Forged',
		materials: '99',
		productIds: '5',
		productCounts: '2',
		endDate: '2026-01-02',
		customPrice: '0.01'
	}))
		form.set(key, value);
	const taskEdit = await server.ssrLoadModule(
		'/src/routes/(app)/projekti/labot/[id]/+page.server.ts'
	);
	await assert.rejects(
		() => taskEdit.actions.default({ ...event, request: { formData: async () => form } }),
		{ status: 303 }
	);
	assert.equal(saved.clientId, 7);
	assert.equal(saved.seamstress, 'Retained');
	assert.equal(
		saved.price,
		160,
		'Use the task client price, not the first linked client or forged custom price'
	);
	assert.deepEqual(inserts.get('task_assignees'), [{ taskId: 11, userId: 'staff' }]);
	assert.deepEqual(inserts.get('taskMaterials'), [{ taskId: 11, materialId: 3 }]);
	form.set('clientId', '9');
	await assert.rejects(
		() => taskEdit.actions.default({ ...event, request: { formData: async () => form } }),
		{ status: 403 }
	);
	links = [{ clientId: 7 }];

	// SSE is only an invalidation signal: no private task payload, even for allowed events.
	const events = await server.ssrLoadModule('/src/routes/api/events/+server.ts');
	const { taskEvents } = await server.ssrLoadModule('/src/lib/server/events.ts');
	const response = await events.GET({ locals: { user: alice } });
	const reader = response.body.getReader();
	await reader.read();
	taskEvents.emitTaskUpdate(
		{ id: 11, tabId: 1, clientId: 8, createdById: 'alice', title: 'FOREIGN SECRET' },
		'delete',
		['alice']
	);
	taskEvents.emitTaskUpdate(
		{ id: 12, tabId: 1, clientId: 7, title: 'PRIVATE OFFICE FIELD' },
		'update'
	);
	assert.equal((await reader.read()).value, 'data: {"type":"update"}\n\n');
	await reader.cancel();
	console.log(
		'Client access assertions passed: linked clients/drafts, unrestricted staff, task APIs, office-only management and minimal SSE. No live mutations.'
	);
} finally {
	await server.close();
}
