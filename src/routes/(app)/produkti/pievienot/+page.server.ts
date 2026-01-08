import { db } from '$lib/server/db';
import { product } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as m from '$lib/paraglide/messages';

export const load = async () => {};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const title = form.get('title') as string;
		const description = form.get('description') as string;
		const cost = form.get('cost');

		try {
			await db.insert(product).values({
				title: title,
				description: description,
				cost: Number(cost)
			});
		} catch (error) {
			return fail(500, { message: m['products.errors.creation_failed']() });
		}

		redirect(303, '/produkti');
	}
};
