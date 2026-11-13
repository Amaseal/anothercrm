import { eq } from 'drizzle-orm';
import {
	task,
	taskMaterial,
	taskProduct,
	file,
	invoice,
	taskAssignee
} from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { taskEvents } from '$lib/server/events';
import { assertTaskAccess } from '$lib/server/task-access';
import { assertTaskHasNoProductionProjects } from '$lib/server/production-projects';
import { isProductionStoragePath } from '$lib/server/file-download';

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

				// 2. Delete linked files from disk
				const deletionPromises = [];

				// Task preview image
				if (
					item.preview &&
					!isProductionStoragePath(join('uploads', item.preview.replace(/^\/uploads\//, '')))
				) {
					// preview is like /uploads/filename.ext
					// We need to remove leading slash to make it relative to CWD if using 'uploads/'
					// Or join(process.cwd(), item.preview) - but item.preview has leading slash likely.
					// Based on pievienot implementation: `previewUrl = /uploads/${fileName}`
					// And `const uploadDir = 'uploads'`, `writeFile(join(uploadDir, fileName))`
					// So if we have `/uploads/foo.jpg`, we want `uploads/foo.jpg` (relative) or absolute path.
					const relativePath = item.preview.startsWith('/')
						? item.preview.substring(1)
						: item.preview;
					deletionPromises.push(
						unlink(join(process.cwd(), relativePath)).catch((err) =>
							console.error('Failed to delete preview:', err)
						)
					);
				}

				// Associated files
				if (item.files && item.files.length > 0) {
					for (const f of item.files) {
						if (
							f.downloadUrl &&
							!isProductionStoragePath(join('uploads', f.downloadUrl.replace(/^\/uploads\//, '')))
						) {
							const relativePath = f.downloadUrl.startsWith('/')
								? f.downloadUrl.substring(1)
								: f.downloadUrl;
							deletionPromises.push(
								unlink(join(process.cwd(), relativePath)).catch((err) =>
									console.error('Failed to delete file:', err)
								)
							);
						}
					}
				}

				await Promise.all(deletionPromises);

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
					{ id: taskId, tabId: item.tabId } as any,
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
