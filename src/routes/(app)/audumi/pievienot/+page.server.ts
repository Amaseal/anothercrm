import { db } from '$lib/server/db';
import { material } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as m from '$lib/paraglide/messages';

export const load = async () => {};

export const actions: Actions = {
	default: async ({ request }) => {
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
			await db.insert(material).values({
				title,
				article,
				manufacturer,
				gsm,
				width,
				remaining,
				image
			});
		} catch (error) {
			return fail(500, { message: m['materials.errors.something_went_wrong']() });
		}

		redirect(303, '/audumi');
	}
};
