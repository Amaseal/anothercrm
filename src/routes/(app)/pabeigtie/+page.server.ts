import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { taskEvents } from '$lib/server/events';

export const actions: Actions = {
    restore: async ({ request }) => {
        const formData = await request.formData();
        const taskIdStr = formData.get('taskId');

        if (!taskIdStr) {
            return fail(400, { message: 'Missing Task ID' });
        }

        const taskId = Number(taskIdStr);

        try {
            const result = await db
                .update(task)
                .set({ isDone: false })
                .where(eq(task.id, taskId))
                .returning();

            if (result.length > 0) {
                taskEvents.emitTaskUpdate(result[0], 'update');
            }

            return { success: true };
        } catch (error) {
            console.error('Error restoring task:', error);
            return fail(500, { message: 'Failed to restore task' });
        }
    }
};
