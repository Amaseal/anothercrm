import { db } from '$lib/server/db';
import { material, file } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { stat } from 'fs/promises';
import { join } from 'path';
import * as m from '$lib/paraglide/messages';

export const load = async () => { };

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

			if (image) {
				try {
					const filename = image.split('/').pop() || image;
					const filePath = join('uploads', filename);
					const fileStat = await stat(filePath);

					await db.insert(file).values({
						filename: filename,
						downloadUrl: image,
						size: fileStat.size,
						taskId: null,
						created_at: new Date()
					});
				} catch (e) {
					console.error('Failed to create file record for material image:', e);
				}
			}
		} catch (error) {
			return fail(500, { message: m['materials.errors.something_went_wrong']() });
		}

		redirect(303, '/audumi');
	}
};
