import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { tabGroup, tab } from '@/server/db/schema';
import { eq } from 'drizzle-orm/sql/expressions/conditions';

export const load: PageServerLoad = async () => {
	// Fetch all tab groups with their nested tabs and translations
	const tabGroups = await db.query.tabGroup.findMany({
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)],
		with: {
			translations: true,
			tabs: {
				orderBy: (tab, { asc }) => [asc(tab.sortOrder)],
				with: {
					translations: true,
					owner: true
				}
			}
		}
	});

	return {
		tabGroups
	};
};

export const actions: Actions = {
	reorderGroups: async ({ request }) => {
		const formData = await request.formData();

		// Parse the order data
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('order[')) {
				const id = parseInt(key.match(/\d+/)?.[0] || '0');
				const sortOrder = parseInt(value as string);

				await db.update(tabGroup).set({ sortOrder }).where(eq(tabGroup.id, id));
			}
		}

		return { success: true };
	},
	reorderTabs: async ({ request }) => {
		const formData = await request.formData();

		// Parse the order data
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('order[')) {
				const id = parseInt(key.match(/\d+/)?.[0] || '0');
				const sortOrder = parseInt(value as string);

				await db.update(tab).set({ sortOrder }).where(eq(tab.id, id));
			}
		}

		return { success: true };
	},
	moveTabToGroup: async ({ request }) => {
		const formData = await request.formData();
		const tabId = formData.get('tabId') as string;
		const newGroupId = formData.get('newGroupId') as string;

		if (!tabId || !newGroupId) {
			return { success: false, message: 'Missing required parameters' };
		}

		const tabIdNum = parseInt(tabId, 10);
		const newGroupIdNum = parseInt(newGroupId, 10);

		if (isNaN(tabIdNum) || isNaN(newGroupIdNum)) {
			return { success: false, message: 'Invalid parameters' };
		}

		try {
			// Update the tab's groupId
			await db.update(tab).set({ groupId: newGroupIdNum }).where(eq(tab.id, tabIdNum));
			return { success: true };
		} catch (error) {
			return { success: false, message: 'Database error' };
		}
	}
};
