import { eq } from 'drizzle-orm';
import { material } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.material.findFirst({
		where: eq(material.id, Number(params.id))
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params, fetch, cookies }) => {
		try {
			// Get the material to find the image path
			const item = await db.query.material.findFirst({
				where: eq(material.id, Number(params.id))
			});
			if (item && item.image) {
				// Remove leading slash if present
				let imagePath = item.image.startsWith('/') ? item.image.slice(1) : item.image;
				// Only try to delete if it's not empty
				if (imagePath) {
					// Remove uploads/ prefix if present for API
					imagePath = imagePath.replace(/^uploads\//, '');
					try {
						await fetch('/api/remove', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ path: imagePath })
						});
					} catch (e) {
						// Ignore error, API handles file not found gracefully
					}
				}
			}
			await db.delete(material).where(eq(material.id, Number(params.id)));
		} catch (error) {
			return fail(400, { message: m['components.delete_modal.error']({ item: params.id }) });
		}

		redirect(303, '/audumi');
	}
};
