import { eq } from 'drizzle-orm';
import { product } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.product.findFirst({
		where: eq(product.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params }) => {
		try {
			await db.delete(product).where(eq(product.id, Number(params.id)));
		} catch (error) {
			return fail(400, { message: m['components.delete_modal.error']({ item: params.id }) });
		}
		redirect(303, '/produkti');
	}
};
