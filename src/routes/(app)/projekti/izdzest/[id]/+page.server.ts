import { eq } from 'drizzle-orm';
import { task, taskMaterial, taskProduct, invoice, taskAssignee } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { unlink } from 'fs/promises';
import { taskEvents } from '$lib/server/events';
import { assertTaskAccess } from '$lib/server/task-access';
import { assertTaskHasNoProductionProjects } from '$lib/server/production-projects';
import { ordinaryTaskFilePaths } from '$lib/server/file-download';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertTaskAccess(locals, Number(params.id));
	const item = await db.query.task.findFirst({
		where: eq(task.id, Number(params.id))
	});

	if (!item) {
		throw redirect(303, '/projekti');
	}

	return { item };
};

export const actions: Actions = {
	default: async ({ params, locals }) => {
		const taskId = Number(params.id);
		await assertTaskAccess(locals, taskId);
		await assertTaskHasNoProductionProjects(taskId);
		try {
			const result = await db.transaction(async (tx) => {
				await tx.select({ id: task.id }).from(task).where(eq(task.id, taskId)).for('update');
				await assertTaskHasNoProductionProjects(taskId, tx);
				// 1. Get task to find associated files
				const item = await tx.query.task.findFirst({
					where: eq(task.id, taskId),
					with: {
						files: true
					}
				});

				if (!item) {
					return fail(404, { message: 'Task not found' });
				}

				const paths = ordinaryTaskFilePaths(item);
				await Promise.all(
					paths.map((path) =>
						unlink(path).catch((err) => console.error('Failed to delete task file:', err))
					)
				);

				// Fetch assignees before deletion so the SSE event can filter correctly
				const assignees = await tx.query.taskAssignee.findMany({
					where: eq(taskAssignee.taskId, taskId),
					columns: { userId: true }
				});

				// 3. Delete DB relations that don't cascade automatically
				// Unlink invoices
				await tx.update(invoice).set({ taskId: null }).where(eq(invoice.taskId, taskId));

				await tx.delete(taskMaterial).where(eq(taskMaterial.taskId, taskId));
				await tx.delete(taskProduct).where(eq(taskProduct.taskId, taskId));

				// Files have cascade on delete task ?? No, actually wait.
				// Schema: `taskId: integer('task_id').references(() => task.id, { onDelete: 'cascade' })`
				// Yes, files have cascade! So deleting task will delete file records.
				// We only needed to delete physical files above.

				// 4. Delete the task
				await tx.delete(task).where(eq(task.id, taskId));

				// Emit delete event
				taskEvents.emitTaskUpdate(
					{ id: taskId, tabId: item.tabId },
					'delete',
					assignees.map((a) => a.userId)
				);
			});
			if (result) return result;
		} catch (error) {
			console.error(error);
			return fail(400, { message: m['components.delete_modal.error']({ item: params.id }) });
		}

		redirect(303, '/projekti');
	}
};
