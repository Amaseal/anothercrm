import { taskEvents } from '$lib/server/events';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { userClient } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Pre-fetch linked client IDs for client users (needed for event filtering)
    let linkedClientIds: number[] = [];
    if (user.type === 'client') {
        const userClients = await db.query.userClient.findMany({
            where: eq(userClient.userId, user.id),
            columns: { clientId: true }
        });
        linkedClientIds = userClients.map((uc) => uc.clientId);
    }

    let onTaskEvent: ((data: { type: string; task: any; assigneeUserIds: string[] }) => void) | undefined;

    const readable = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            onTaskEvent = (data: { type: string; task: any; assigneeUserIds: string[] }) => {

                const { task, assigneeUserIds } = data;                // Filtering Logic
                // Admin: Sees everything
                // Client visibility rules (mirrors getProjectBoardData):
                //   C1. Creator always sees their own task
                //   C2. Assignee always sees tasks assigned to them
                //   C3. Task client matches linked client entry → always visible
                let shouldSend = false;                if (user.type === 'admin') {
                    shouldSend = true;
                } else {
                    const isAssignedToMe = assigneeUserIds.includes(user.id);
                    const createdByMe = task?.createdById === user.id;
                    const isMyClientTask = linkedClientIds.length > 0 && linkedClientIds.includes(task?.clientId);

                    // C1: creator always sees their task
                    if (createdByMe) shouldSend = true;
                    // C2: assigned to me
                    else if (isAssignedToMe) shouldSend = true;
                    // C3: task client matches my linked client (regardless of assignees)
                    else if (isMyClientTask) shouldSend = true;
                }



                if (shouldSend) {
                    // Safety check: ensure controller is open
                    // Note: desiredSize check isn't always reliable for immediate closure detection in all envs,
                    // but catching the error is the fallback.

                    try {

                        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
                    } catch (e) {
                        // Check if it's a closed controller error

                    }
                }
            };

            taskEvents.on('task', onTaskEvent);
        },
        cancel() {
            // Cleanup handled
            if (onTaskEvent) {

                taskEvents.off('task', onTaskEvent);
            }
        }
    });

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
};
