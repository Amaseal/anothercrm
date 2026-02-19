import { taskEvents } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    let onTaskEvent: ((data: { type: string; task: any }) => void) | undefined;

    const readable = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            onTaskEvent = (data: { type: string; task: any }) => {
                console.log('SSE: Event received', data.type, 'Task ID:', data.task?.id);
                const { task } = data;

                // Filtering Logic
                // Admin: Sees everything
                // Client: Sees if createdBy them OR assignedTo them
                let shouldSend = false;

                if (user.type === 'admin') {
                    shouldSend = true;
                } else {
                    if (task?.createdById === user.id || task?.assignedToUserId === user.id) {
                        shouldSend = true;
                    }
                }

                console.log(`SSE: User ${user.id} (${user.type}) shouldSend: ${shouldSend}`);

                if (shouldSend) {
                    // Safety check: ensure controller is open
                    // Note: desiredSize check isn't always reliable for immediate closure detection in all envs,
                    // but catching the error is the fallback.

                    try {
                        console.log('SSE: Enqueueing data');
                        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
                    } catch (e) {
                        // Check if it's a closed controller error
                        console.log('SSE Enqueue Error (likely closed):', e);
                    }
                }
            };

            taskEvents.on('task', onTaskEvent);
        },
        cancel() {
            // Cleanup handled
            if (onTaskEvent) {
                console.log('SSE Cancel: Removing listener for user', user.id);
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
