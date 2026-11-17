import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { task, userClient, type Task } from '$lib/server/db/schema';

export async function getClientScope(locals: App.Locals) {
	if (!locals.user) error(401, 'Unauthorized');
	if (locals.user.type !== 'client') return null;
	const links = await db.query.userClient.findMany({
		where: eq(userClient.userId, locals.user.id),
		columns: { clientId: true }
	});
	return links.map((link) => link.clientId);
}

export function canAccessTask(
	user: { id: string; type: string },
	item: Pick<Task, 'clientId' | 'createdById'>,
	linkedClientIds: number[]
) {
	if (user.type !== 'client') return true;
	return item.clientId === null
		? item.createdById === user.id
		: linkedClientIds.includes(item.clientId);
}

export function clientTaskCondition(userId: string, linkedClientIds: number[]) {
	return or(
		and(isNull(task.clientId), eq(task.createdById, userId)),
		linkedClientIds.length ? inArray(task.clientId, linkedClientIds) : sql`false`
	)!;
}

export async function assertClientAccess(locals: App.Locals, clientId: number | null) {
	if (
		clientId !== null &&
		(!Number.isInteger(clientId) || clientId < 1 || clientId > 2_147_483_647)
	)
		error(400, 'Invalid client');
	const scope = await getClientScope(locals);
	if (scope !== null && clientId !== null && !scope.includes(clientId)) error(403, 'Forbidden');
}

export async function assertTaskAccess(locals: App.Locals, taskId: number) {
	if (!locals.user) error(401, 'Unauthorized');
	if (!Number.isInteger(taskId) || taskId < 1 || taskId > 2_147_483_647)
		error(404, 'Task not found');
	const item = await db.query.task.findFirst({
		where: eq(task.id, taskId),
		columns: { id: true, clientId: true, createdById: true }
	});
	if (!item) error(404, 'Task not found');
	const scope = await getClientScope(locals);
	if (!canAccessTask(locals.user, item, scope ?? [])) error(403, 'Forbidden');
	return item;
}
