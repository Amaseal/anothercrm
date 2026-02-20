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
