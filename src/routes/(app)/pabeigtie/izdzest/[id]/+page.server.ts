import { eq } from 'drizzle-orm';
import { task, taskAssignee } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { taskEvents } from '$lib/server/events';
import { assertTaskAccess } from '$lib/server/task-access';
import { assertTaskHasNoProductionProjects } from '$lib/server/production-projects';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertTaskAccess(locals, Number(params.id));
	const item = await db.query.task.findFirst({
		where: eq(task.id, Number(params.id))
	});

	if (!item) {
		throw redirect(303, '/pabeigtie');
	}

	// Map task title to 'name' property to reuse generic delete modal if it expects 'name'
	// task has 'title', client has 'name'. Components might expect one or other.
	// The previous delete modal used `data.item.name`.
	// I should check `izdzest/[id]/+page.svelte`.
	return {
		item: {
			...item,
			name: item.title // Polyfill name for consistency
		}
	};
};

export const actions: Actions = {
	default: async ({ params, locals }) => {
		const id = Number(params.id);
		await assertTaskAccess(locals, id);
		await assertTaskHasNoProductionProjects(id);
		try {
			// Fetch task first to get tabId for event (though invalidateAll might not strictly need it, good practice)
			const item = await db.query.task.findFirst({
				where: eq(task.id, id)
			});

			const assignees = await db.query.taskAssignee.findMany({
				where: eq(taskAssignee.taskId, id),
				columns: { userId: true }
			});

			await db.delete(task).where(eq(task.id, id));

			if (item) {
				taskEvents.emitTaskUpdate(
					item,
					'delete',
					assignees.map((a) => a.userId)
				);
			}
		} catch (error) {
			return fail(400, { message: m['components.delete_modal.error']({ item: id.toString() }) });
		}
		redirect(303, '/pabeigtie');
	}
};
