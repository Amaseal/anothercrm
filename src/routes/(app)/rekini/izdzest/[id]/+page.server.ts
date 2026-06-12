import { eq, sql } from 'drizzle-orm';
import { invoice, client } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.invoice.findFirst({
		where: eq(invoice.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params, locals }) => {
		if (!locals.user || locals.user.type !== 'admin') error(403);
		try {
            const invoiceId = Number(params.id);
            const existingInvoice = await db.query.invoice.findFirst({
                where: eq(invoice.id, invoiceId)
            });

            await db.transaction(async (tx) => {
                if (existingInvoice?.clientId) {
                    await tx.update(client)
                        .set({
                            totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) - ${existingInvoice.total}`
                        })
                        .where(eq(client.id, existingInvoice.clientId));
                }
                await tx.delete(invoice).where(eq(invoice.id, invoiceId));
            });
		} catch (e) {
			console.error(e);
			return fail(400, { message: 'Failed to delete invoice' });
		}
		throw redirect(303, '/rekini');
	}
};
