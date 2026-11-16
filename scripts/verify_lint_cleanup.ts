import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'vite';
import { debounce } from '../src/lib/utilities';

// Run with: pnpm exec tsx scripts/verify_lint_cleanup.ts
const calls: string[] = [];
const delayed = debounce((value: string) => calls.push(value), 5);
delayed('first');
delayed('latest');
await setTimeout(20);
assert.deepEqual(calls, ['latest']);
delayed('cancelled');
delayed.cancel();
await setTimeout(20);
assert.deepEqual(calls, ['latest']);

// Exercise the real event filtering with mocked client links, without database mutations.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
	const { GET } = await server.ssrLoadModule('/src/routes/api/events/+server.ts');
	const { taskEvents } = await server.ssrLoadModule('/src/lib/server/events.ts');
	const { db } = await server.ssrLoadModule('/src/lib/server/db/index.ts');
	db.query.userClient.findMany = async () => [{ clientId: 7 }];
	assert.equal((await GET({ locals: { user: null } })).status, 401);

	for (const visibleTask of [
		{ id: 2, tabId: 1, createdById: 'client-user', clientId: 99 },
		{ id: 3, tabId: 1, createdById: 'another-user', clientId: 7 },
		{ id: 4, tabId: 1, createdById: 'another-user', clientId: 99 }
	]) {
		const response = await GET({ locals: { user: { id: 'client-user', type: 'client' } } });
		const reader = response.body.getReader();
		assert.match(String((await reader.read()).value), /connected/);
		taskEvents.emitTaskUpdate(undefined, 'update');
		taskEvents.emitTaskUpdate({ id: 1, tabId: 1, clientId: 99 }, 'update');
		taskEvents.emitTaskUpdate(visibleTask, 'update', visibleTask.id === 4 ? ['client-user'] : []);
		const payload = JSON.parse(String((await reader.read()).value).replace(/^data: /, ''));
		assert.equal(payload.task.id, visibleTask.id);
		await reader.cancel();
		assert.equal(taskEvents.listenerCount('task'), 0);
	}

	const response = await GET({ locals: { user: { id: 'admin-user', type: 'admin' } } });
	const reader = response.body.getReader();
	await reader.read();
	taskEvents.emitTaskUpdate({ id: 5, tabId: 1 }, 'delete');
	assert.match(String((await reader.read()).value), /"id":5/);
	await reader.cancel();
	assert.equal(taskEvents.listenerCount('task'), 0);
} finally {
	await server.close();
}
console.log('Lint cleanup checks passed (debounce and event visibility; no DB mutations).');
