import { eq } from 'drizzle-orm';
import { product } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';
import { assertStaff } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }) => {
	assertStaff(locals);
	const item = await db.query.product.findFirst({
		where: eq(product.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params, locals }) => {
		assertStaff(locals);
		try {
			await db.delete(product).where(eq(product.id, Number(params.id)));
		} catch {
			return fail(400, { message: m['components.delete_modal.error']({ item: params.id }) });
		}
		redirect(303, '/produkti');
	}
};
