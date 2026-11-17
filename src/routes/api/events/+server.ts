import { taskEvents } from '$lib/server/events';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { userClient } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { canAccessTask } from '$lib/server/task-access';

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

	let onTaskEvent:
		| ((data: {
				type: string;
				task: Parameters<typeof taskEvents.emitTaskUpdate>[0];
				assigneeUserIds: string[];
		  }) => void)
		| undefined;

	const readable = new ReadableStream({
		start(controller) {
			// Send initial connection message
			controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

			onTaskEvent = (data: {
				type: string;
				task: Parameters<typeof taskEvents.emitTaskUpdate>[0];
				assigneeUserIds: string[];
			}) => {
				const { task } = data;
				if (
					task &&
					canAccessTask(
						user,
						{ clientId: task.clientId ?? null, createdById: task.createdById ?? null },
						linkedClientIds
					)
				) {
					// Safety check: ensure controller is open
					// Note: desiredSize check isn't always reliable for immediate closure detection in all envs,
					// but catching the error is the fallback.

					try {
						controller.enqueue(`data: ${JSON.stringify({ type: data.type })}\n\n`);
					} catch {
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
			Connection: 'keep-alive'
		}
	});
};
