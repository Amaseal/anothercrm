import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { invoice, userClient } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

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

	if (locals.user.type === 'client') {
		const linked = await db.query.userClient.findFirst({
			where: and(eq(userClient.userId, locals.user.id), eq(userClient.clientId, item.clientId)),
			columns: { userId: true }
		});
		if (!linked) error(403, 'Forbidden');
	}

	const company = await db.query.companySettings.findFirst();

	return {
		invoice: item,
		company
	};
};
