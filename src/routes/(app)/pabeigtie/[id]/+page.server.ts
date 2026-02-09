import { db } from '$lib/server/db';
import { task } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const taskId = Number(params.id);

    const item = await db.query.task.findFirst({
        where: eq(task.id, taskId),
        with: {
            client: true,
            assignedToUser: true,
            creator: true,
            taskMaterials: {
                with: {
                    material: true
                }
            },
            taskProducts: {
                with: {
                    product: true
                }
            },
            files: true
        }
    });

    if (!item) {
        throw redirect(303, '/pabeigtie');
    }

    return {
        item
    };
};
