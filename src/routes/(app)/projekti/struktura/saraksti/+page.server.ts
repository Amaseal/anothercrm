import type { Actions, PageServerLoad } from '../$types';
import { db } from '$lib/server/db';
import { tab, tabGroup, tabTranslation } from '@/server/db/schema';
import { eq } from 'drizzle-orm/sql/expressions/conditions';
import { locales } from '@/paraglide/runtime.js';
import { sql } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const tabGroups = await db.query.tabGroup.findMany({
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)],
		with: {
			translations: true
		}
	});
	const groupId = url.searchParams.get('group');
	return {
		tabGroups,
		preselectedGroupId: groupId
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const color = formData.get('color') as string;
		const groupIdStr = formData.get('group') as string | null;

		if (!groupIdStr) {
			return fail(400, {
				message: 'Group is required'
			});
		}

		const groupId = parseInt(groupIdStr, 10);

		if (isNaN(groupId)) {
			return fail(400, {
				message: 'Invalid group ID'
			});
		}

		if (!locales.every((locale) => formData.get(`title-${locale}`))) {
			return fail(400, {
				message: m['groups.errors.required']()
			});
		}

		try {
			const maxOrder = await db
				.select({ max: sql<number>`COALESCE(MAX(${tab.sortOrder}), -1)` })
				.from(tab)
				.where(eq(tab.groupId, groupId));

			const nextSortOrder = (maxOrder[0]?.max ?? -1) + 1;

			// Step 2: Create the tab with next sort order
			const [newTab] = await db
				.insert(tab)
				.values({
					sortOrder: nextSortOrder,
					groupId: groupId,
					color: color
				})
				.returning();

			// Step 3: Prepare translations for all locales
			const translations = locales.map((locale) => ({
				tabId: newTab.id,
				language: locale,
				name: formData.get(`title-${locale}`) as string
			}));

			// Step 4: Insert all translations
			await db.insert(tabTranslation).values(translations);

			// Redirect on success
		} catch (error) {
			console.log(error);
			return {
				success: false,
				message: 'Something went wrong while adding the tab.'
			};
		}

		redirect(303, '/projekti/struktura');
	}
};
