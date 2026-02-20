import { db } from '$lib/server/db';
import { tabGroup, tabGroupTranslation } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { locales } from '@/paraglide/runtime.js';
import { sql } from 'drizzle-orm';
import type { Actions } from './$types';
import * as m from '$lib/paraglide/messages';

export const actions: Actions = {
	default: async ({ request }) => {
		let formData = await request.formData();
		if (!locales.every((locale) => formData.get(`title-${locale}`))) {
			return fail(400, {
				message: m['groups.errors.required']()
			});
		}
		try {
			// Step 1: Get the maximum sort order
			const maxOrder = await db
				.select({ max: sql<number>`COALESCE(MAX(${tabGroup.sortOrder}), -1)` })
				.from(tabGroup);

			const nextSortOrder = (maxOrder[0]?.max ?? -1) + 1;

			// Step 2: Create the group with next sort order
			const [newGroup] = await db
				.insert(tabGroup)
				.values({
					sortOrder: nextSortOrder,
					color: (formData.get('color') as string) || '#ffffff'
				})
				.returning();

			// Step 3: Prepare translations for all locales
			const translations = locales.map((locale) => ({
				tabGroupId: newGroup.id,
				language: locale,
				name: formData.get(`title-${locale}`) as string
			}));

			// Step 4: Insert all translations
			await db.insert(tabGroupTranslation).values(translations);

			// Redirect on success
		} catch (error) {
			return fail(500, {
				message: m['groups.errors.something_went_wrong']()
			});
		}
		redirect(303, '/projekti/struktura');
	}
};
