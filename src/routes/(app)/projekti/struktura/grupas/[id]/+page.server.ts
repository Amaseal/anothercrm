import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { tabGroup, tabGroupTranslation } from '$lib/server/db/schema';
import { client } from '$lib/server/db/schema';
import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';
import { locales } from '@/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.tabGroup.findFirst({
		where: eq(tabGroup.id, Number(params.id)),
		with: { translations: true }
	});
	return { item };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		let formData = await request.formData();
		if (!locales.every((locale) => formData.get(`title-${locale}`))) {
			return fail(400, {
				message: m['groups.errors.required']()
			});
		}
		try {
			const groupId = Number(params.id);

			// Update each translation
			for (const locale of locales) {
				await db
					.update(tabGroupTranslation)
					.set({
						name: formData.get(`title-${locale}`) as string
					})
					.where(
						sql`${tabGroupTranslation.tabGroupId} = ${groupId} AND ${tabGroupTranslation.language} = ${locale}`
					);
			}
		} catch (error) {
			console.log(error);
			return fail(500, {
				message: m['groups.errors.something_went_wrong']()
			});
		}
		redirect(303, '/projekti/struktura');
	}
};
