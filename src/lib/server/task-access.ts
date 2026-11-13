import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { task, taskAssignee, userClient } from '$lib/server/db/schema';

export async function assertTaskAccess(locals: App.Locals, taskId: number) {
	if (!locals.user) error(401, 'Unauthorized');
	if (!Number.isInteger(taskId) || taskId < 1 || taskId > 2_147_483_647)
		error(404, 'Task not found');
	const item = await db.query.task.findFirst({
		where: eq(task.id, taskId),
		columns: { id: true, clientId: true, createdById: true }
	});
	if (!item) error(404, 'Task not found');
	if (locals.user.type === 'admin' || item.createdById === locals.user.id) return;
	const assigned = await db.query.taskAssignee.findFirst({
		where: and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.userId, locals.user.id))
	});
	if (assigned) return;
	if (item.clientId) {
		const linked = await db.query.userClient.findFirst({
			where: and(eq(userClient.userId, locals.user.id), eq(userClient.clientId, item.clientId))
		});
		if (linked) return;
	}
	error(403, 'Forbidden');
}
