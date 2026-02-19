import { eq } from 'drizzle-orm';
import { task } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { taskEvents } from '$lib/server/events';

export const load: PageServerLoad = async ({ params }) => {
    const item = await db.query.task.findFirst({
        where: eq(task.id, Number(params.id))
    });

    if (!item) {
        throw redirect(303, '/pabeigtie');
    }

    // Map task title to 'name' property to reuse generic delete modal if it expects 'name'
    // task has 'title', client has 'name'. Components might expect one or other.
    // The previous delete modal used `data.item.name`. 
    // I should check `izdzest/[id]/+page.svelte`.
    return {
        item: {
            ...item,
            name: item.title // Polyfill name for consistency
        }
    };
};

export const actions: Actions = {
    default: async ({ params }) => {
        const id = Number(params.id);
        try {
            // Fetch task first to get tabId for event (though invalidateAll might not strictly need it, good practice)
            const item = await db.query.task.findFirst({
                where: eq(task.id, id)
            });

            await db.delete(task).where(eq(task.id, id));

            if (item) {
                taskEvents.emitTaskUpdate(item, 'delete');
            }
        } catch (error) {
            return fail(400, { message: m['components.delete_modal.error']({ item: id.toString() }) });
        }
        redirect(303, '/pabeigtie');
    }
};
