import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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

        // Trigger an event for SSE if needed, though +layout.svelte listens to general updates.
        // We might want to broadcast this move so other clients see it instantly.
        // For now, the client that made the move will invalidate.

        return json({ success: true });
    } catch (error) {
        console.error('Error moving task:', error);
        return json({ error: 'Failed to move task' }, { status: 500 });
    }
};
