import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';

import { product } from '$lib/server/db/schema';

import { eq } from 'drizzle-orm';
import type { Product } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { m } from '@/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	let item = (await db.query.product.findFirst({
		where: eq(product.id, Number(params.id))
	})) as Product;

	return { item };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title') as string;
		const description = form.get('description') as string;
		const cost = form.get('cost');

		try {
			await db
				.update(product)
				.set({
					title: title,
					description: description,
					cost: Number(cost)
				})
				.where(eq(product.id, Number(params.id)));
		} catch (error) {
			return fail(500, { message: m['products.errors.update_failed']() });
		}

		redirect(303, '/produkti');
	}
};
