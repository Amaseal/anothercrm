import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { task, tab } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { taskEvents } from '$lib/server/events';
import { recordHistory } from '$lib/server/history';
import { sendEmail } from '$lib/server/mailUtils';

export const POST = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId, targetTabId } = await request.json();

    if (!taskId || !targetTabId) {
        return json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        // 1. Fetch current task to know where it is coming from
        const currentTask = await db.query.task.findFirst({
            where: eq(task.id, taskId),
            with: {
                tab: {
                    with: {
                        group: {
                            with: {
                                translations: true
                            }
                        }
                    }
                },
                creator: true
            }
        });

        if (!currentTask) {
            return json({ error: 'Task not found' }, { status: 404 });
        }

        // 2. Perform the Move
        await db
            .update(task)
            .set({ tabId: targetTabId })
            .where(eq(task.id, taskId));

        // 3. Fetch New Group Info (to see if group changed)
        const newTab = await db.query.tab.findFirst({
            where: eq(tab.id, targetTabId),
            with: {
                group: {
                    with: {
                        translations: true
                    }
                }
            }
        });

        // 4. Check for Group Change and Record History
        const oldGroupId = currentTask.tab?.groupId;
        const newGroupId = newTab?.groupId;

        if (oldGroupId && newGroupId && oldGroupId !== newGroupId) {
            // Helper to get name
            const getName = (g: any) => {
                const t = g.translations.find((t: any) => t.language === 'lv') || g.translations[0];
                return t ? t.name : 'Unknown Group';
            };

            const oldGroupName = currentTask.tab.group ? getName(currentTask.tab.group) : 'Unknown';
            const newGroupName = newTab.group ? getName(newTab.group) : 'Unknown';

            await recordHistory(
                taskId,
                locals.user.id,
                'updated',
                [{ field: 'group', from: oldGroupName, to: newGroupName }],
                `Moved from ${oldGroupName} to ${newGroupName}`
            );

            // Send email if creator is a client
            if (currentTask.creator && currentTask.creator.type === 'client' && currentTask.creator.email) {
                try {
                    await sendEmail(
                        currentTask.creator.email,
                        `Status Update: ${currentTask.title}`,
                        `
                        <h2>Task Updated</h2>
                        <p>Your task <strong>${currentTask.title}</strong> has been moved to <strong>${newGroupName}</strong>.</p>
                        <p>Best regards,<br>Fast Break</p>
                        `
                    );
                } catch (emailError) {
                    console.error('Failed to send email notification:', emailError);
                    // Don't fail the request if email fails
                }
            }
        }

        // Fetch updated task for SSE and emission
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
