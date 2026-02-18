import { db } from '$lib/server/db';
import { taskHistory } from '$lib/server/db/schema';

export type HistoryChange = {
    field: string;
    from?: any;
    to?: any;
    type?: string;
};

export async function recordHistory(
    taskId: number,
    userId: string | null,
    changeType: string,
    changes: HistoryChange[],
    description: string
) {
    if (changes.length === 0 && !description) return;

    // Filter out purely internal fields if needed, or format values
    const changeData = JSON.stringify(changes);

    await db.insert(taskHistory).values({
        taskId,
        userId,
        changeType,
        changeData,
        description
    });
}
