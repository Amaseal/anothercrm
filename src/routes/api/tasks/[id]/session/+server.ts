import { db } from '$lib/server/db';
import { taskEditSession, user } from '$lib/server/db/schema';
import { json, type RequestEvent } from '@sveltejs/kit';
import { eq, and, lt } from 'drizzle-orm';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function GET({ params }: RequestEvent) {
    const taskId = Number(params.id);
    if (isNaN(taskId)) return json({ error: 'Invalid Task ID' }, { status: 400 });

    // Clean up expired sessions first (lazy cleanup)
    const now = new Date();
    await db.delete(taskEditSession).where(lt(taskEditSession.expiresAt, now));

    const session = await db.query.taskEditSession.findFirst({
        where: eq(taskEditSession.taskId, taskId),
        with: {
            user: true
        }
    });

    if (session) {
        return json({
            isLocked: true,
            user: {
                id: session.user.id,
                name: session.user.name
            },
            expiresAt: session.expiresAt
        });
    }

    return json({ isLocked: false });
}

export async function POST({ params, locals }: RequestEvent) {
    const user = locals.user;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const taskId = Number(params.id);
    if (isNaN(taskId)) return json({ error: 'Invalid Task ID' }, { status: 400 });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);

    // 1. Check for existing session
    const currentSession = await db.query.taskEditSession.findFirst({
        where: eq(taskEditSession.taskId, taskId)
    });

    if (currentSession) {
        // If session exists
        if (currentSession.userId === user.id) {
            // My session: extend it
            await db.update(taskEditSession).set({
                lastActivityAt: now,
                expiresAt: expiresAt
            }).where(eq(taskEditSession.id, currentSession.id));
            return json({ success: true, status: 'extended' });
        } else {
            // Someone else's session
            if (currentSession.expiresAt < now) {
                // Expired: take over
                await db.delete(taskEditSession).where(eq(taskEditSession.id, currentSession.id));
                // fall through to insert
            } else {
                // Active and not mine: Locked
                return json({ error: 'Task is currently being edited by another user' }, { status: 423 }); // 423 Locked
            }
        }
    }

    // 2. Create new session (if no active session exists)
    try {
        await db.insert(taskEditSession).values({
            taskId,
            userId: user.id,
            expiresAt: expiresAt
        });
        return json({ success: true, status: 'created' });
    } catch (e) {
        // Race condition: someone else grabbed it strictly before us
        return json({ error: 'Task is currently being edited by another user' }, { status: 423 });
    }
}

export async function DELETE({ params, locals }: RequestEvent) {
    const user = locals.user;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const taskId = Number(params.id);
    if (isNaN(taskId)) return json({ error: 'Invalid Task ID' }, { status: 400 });

    // Only delete MY session
    await db.delete(taskEditSession).where(
        and(
            eq(taskEditSession.taskId, taskId),
            eq(taskEditSession.userId, user.id)
        )
    );

    return json({ success: true });
}
