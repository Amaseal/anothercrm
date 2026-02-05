import { eq } from 'drizzle-orm';
import { task, file } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { unlink } from 'fs/promises';
import { join } from 'path';

export const load: PageServerLoad = async ({ params }) => {
    const item = await db.query.task.findFirst({
        where: eq(task.id, Number(params.id))
    });

    if (!item) {
        throw redirect(303, '/projekti');
    }

    return { item };
};

export const actions: Actions = {
    default: async ({ params }) => {
        const taskId = Number(params.id);
        try {
            // 1. Get task to find associated files
            const item = await db.query.task.findFirst({
                where: eq(task.id, taskId),
                with: {
                    files: true
                }
            });

            if (!item) {
                return fail(404, { message: 'Task not found' });
            }

            // 2. Delete linked files from disk and DB
            // "When task is mared as done we change the property of isDone to true, 
            // and delete all added files and preview images."

            const deletionPromises = [];

            // Task preview image
            if (item.preview) {
                const relativePath = item.preview.startsWith('/') ? item.preview.substring(1) : item.preview;
                deletionPromises.push(
                    unlink(join(process.cwd(), relativePath)).catch(err => console.error('Failed to delete preview:', err))
                );
            }

            // Associated files
            if (item.files && item.files.length > 0) {
                for (const f of item.files) {
                    if (f.downloadUrl) {
                        const relativePath = f.downloadUrl.startsWith('/') ? f.downloadUrl.substring(1) : f.downloadUrl;
                        deletionPromises.push(
                            unlink(join(process.cwd(), relativePath)).catch(err => console.error('Failed to delete file:', err))
                        );
                    }
                }
            }

            await Promise.all(deletionPromises);

            // Set preview to null
            // Delete DB files
            // Set isDone to true

            // Delete file records (DB)
            // Drizzle doesn't have a "delete all files where taskId = ..." conveniently unless we iterate or do where
            await db.delete(file).where(eq(file.taskId, taskId));

            // Update task
            await db.update(task).set({
                isDone: true,
                preview: null
            }).where(eq(task.id, taskId));

        } catch (error) {
            console.error(error);
            return fail(400, { message: m['components.done_modal.error']({ item: params.id }) });
        }

        redirect(303, '/projekti');
    }
};
