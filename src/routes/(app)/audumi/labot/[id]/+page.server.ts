import { db } from '$lib/server/db';
import { material } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';

import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.material.findFirst({
		where: eq(material.id, Number(params.id))
	});
	return { item };
};

export const actions: Actions = {
	default: async ({ request, params, cookies }) => {
		let form = await request.formData();
		const title = form.get('title') as string;
		const article = form.get('article') as string;
		const manufacturer = form.get('manufacturer') as string;
		const gsm = form.get('gsm') as string;
		const width = form.get('width') as string;
		const remaining = Number(form.get('remaining')) as number;
		const image = form.get('image') as string;

		if (!title || !article) {
			return fail(400, { message: m['materials.errors.required']() });
		}

		try {
			const imageUrl = image || '';

			// Prepare update data
			const updateData = {
				title: title,
				article: article,
				width: width,
				gsm: gsm,
				remaining: remaining,
				manufacturer: manufacturer
			};

			// Only update the image field if it's not empty
			if (imageUrl) {
				Object.assign(updateData, { image: imageUrl });
			}
			await db
				.update(material)
				.set(updateData)
				.where(eq(material.id, Number(params.id)));
		} catch (error) {
			return fail(500, { message: m['materials.errors.update_failed']() });
		}
		redirect(303, '/audumi');
	}
};
