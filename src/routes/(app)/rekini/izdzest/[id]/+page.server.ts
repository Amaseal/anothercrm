import { eq, sql } from 'drizzle-orm';
import { invoice, client } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.invoice.findFirst({
		where: eq(invoice.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params }) => {
		try {
            const invoiceId = Number(params.id);
            // Fetch invoice first to get total and clientId
            const existingInvoice = await db.query.invoice.findFirst({
                where: eq(invoice.id, invoiceId)
            });

            if (existingInvoice && existingInvoice.clientId) {
                // Subtract total from client
                 await db.update(client)
                    .set({ 
                        totalOrdered: sql`COALESCE(${client.totalOrdered}, 0) - ${existingInvoice.total}` 
                    })
                    .where(eq(client.id, existingInvoice.clientId));
            }

			await db.delete(invoice).where(eq(invoice.id, invoiceId));
		} catch (error) {
			console.error(error);
			return fail(400, { message: 'Failed to delete invoice' });
		}
		throw redirect(303, '/rekini');
	}
};
