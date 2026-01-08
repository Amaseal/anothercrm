import { eq } from 'drizzle-orm';
import { client } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.client.findFirst({
		where: eq(client.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params }) => {
		try {
			await db.delete(client).where(eq(client.id, Number(params.id)));
		} catch (error) {
			return fail(400, { message: m['components.delete_modal.error']({ item: client.id }) });
		}
		redirect(303, '/klienti');
	}
};
