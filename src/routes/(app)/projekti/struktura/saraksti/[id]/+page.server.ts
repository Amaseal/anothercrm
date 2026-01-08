import { eq } from 'drizzle-orm';
import { material, tab, tabGroup, type Tab } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { tabTranslation } from '@/server/db/schema';
import { locales } from '@/paraglide/runtime.js';
import { sql } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ url, params }) => {
	const item = await db.query.tab.findFirst({
		where: eq(tab.id, Number(params.id)),
		with: { translations: true, owner: true }
	});
	const tabGroups = await db.query.tabGroup.findMany({
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)],
		with: {
			translations: true
		}
	});

	return {
		tab: item,
		tabGroups
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
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
			const tabId = Number(params.id);

			// Update each translation
			for (const locale of locales) {
				await db
					.update(tabTranslation)
					.set({
						name: formData.get(`title-${locale}`) as string
					})
					.where(
						sql`${tabTranslation.tabId} = ${tabId} AND ${tabTranslation.language} = ${locale}`
					);
			}

			// Step 2: Create the tab with next sort order
			const [newTab] = await db
				.update(tab)

				.set({
					groupId: groupId,
					color: color
				})
				.where(eq(tab.id, tabId));

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
