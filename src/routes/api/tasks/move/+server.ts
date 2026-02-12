import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { taskEvents } from '$lib/server/events';

export const POST = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId, targetTabId } = await request.json();

    if (!taskId || !targetTabId) {
        return json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        // Verify the user has access to this task/project if necessary. 
        // For now assuming if they can call this, they have access or we trust the UI state 
        // ensuring they only see what they can edit.
        // Ideally we should check if the user is allowed to move this task.

        await db
            .update(task)
            .set({ tabId: targetTabId })
            .where(eq(task.id, taskId));

        // Fetch updated task for SSE
        const updatedTask = await db.query.task.findFirst({
            where: eq(task.id, taskId)
        });

        if (updatedTask) {
            taskEvents.emitTaskUpdate(updatedTask, 'update');
        }

        return json({ success: true });
    } catch (error) {
        console.error('Error moving task:', error);
        return json({ error: 'Failed to move task' }, { status: 500 });
    }
};
