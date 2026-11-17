import { eq, sql } from 'drizzle-orm';
import { invoice, client } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import { assertStaff } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	assertStaff(locals);
	const item = await db.query.invoice.findFirst({
		where: eq(invoice.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params, locals }) => {
		assertStaff(locals);
		try {
			const invoiceId = Number(params.id);
			const existingInvoice = await db.query.invoice.findFirst({
				where: eq(invoice.id, invoiceId)
			});

			await db.transaction(async (tx) => {
				if (existingInvoice?.clientId) {
					await tx
						.update(client)
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
