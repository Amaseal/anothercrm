import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { invoice } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    const item = await db.query.invoice.findFirst({
        where: eq(invoice.id, Number(params.id)),
        with: {
            client: true,
            items: true
        }
    });

    if (!item) {
        throw redirect(303, '/rekini');
    }

    const company = await db.query.companySettings.findFirst();

    return {
        invoice: item,
        company
    };
};
