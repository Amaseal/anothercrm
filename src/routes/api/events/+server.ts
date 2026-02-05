import { taskEvents } from '$lib/server/events';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    const user = locals.user;
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const readable = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            const onTaskEvent = (data: { type: string; task: any }) => {
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

                if (shouldSend) {
                    // Safety check: ensure controller is open
                    if (controller.desiredSize === null) return;

                    try {
                        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
                    } catch (e) {
                        console.log('SSE Controller closed, ignoring error');
                        // Controller likely closed, cleanup will handle it
                    }
                }
            };

            taskEvents.on('task', onTaskEvent);

            // Cleanup when connection closes
            return () => {
                taskEvents.off('task', onTaskEvent);
            };
        },
        cancel() {
            // Cleanup handled in start return
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
