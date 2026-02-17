import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { tabGroup, tab, userTabPreference } from '@/server/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	// Fetch user preferences if user is logged in
	const preferences = locals.user
		? await db.query.userTabPreference.findMany({
			where: eq(userTabPreference.userId, locals.user.id)
		})
		: [];

	// Helper to merge preferences into tabs
	const enhanceTabs = (tabs: any[]) => {
		return tabs.map((t) => {
			const pref = preferences.find((p) => p.tabId === t.id);
			return {
				...t,
				isVisible: pref ? pref.isVisible : true, // Default to true
				userSortOrder: pref ? pref.sortOrder : null
			};
		});
	};

	// Fetch all tab groups with their nested tabs and translations
	const rawTabGroups = await db.query.tabGroup.findMany({
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)],
		with: {
			translations: true,
			tabs: {
				where: (tabs, { or, eq, isNull }) =>
					locals.user
						? or(isNull(tabs.userId), eq(tabs.userId, locals.user.id))
						: isNull(tabs.userId),
				orderBy: (tab, { asc }) => [asc(tab.sortOrder)],
				with: {
					translations: true,
					owner: true
				}
			}
		}
	});

	// Apply preferences to tabs within groups
	const tabGroups = rawTabGroups.map((group) => ({
		...group,
		tabs: enhanceTabs(group.tabs)
	}));


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
	},
	toggleVisibility: async ({ request, locals }) => {
		if (!locals.user) {
			return { success: false, message: 'Unauthorized' };
		}

		const formData = await request.formData();
		const tabId = parseInt(formData.get('tabId') as string);
		const isVisible = formData.get('isVisible') === 'true';

		if (isNaN(tabId)) {
			return { success: false, message: 'Invalid tab ID' };
		}

		try {
			// Check if preference exists
			const existingPref = await db.query.userTabPreference.findFirst({
				where: and(
					eq(userTabPreference.userId, locals.user.id),
					eq(userTabPreference.tabId, tabId)
				)
			});

			if (existingPref) {
				await db
					.update(userTabPreference)
					.set({ isVisible })
					.where(eq(userTabPreference.id, existingPref.id));
			} else {
				// We need to know the current sort order when creating a preference
				// For now, we'll default sortOrder to 0 or fetch the tab's default
				// Ideally, userSortOrder should be separate, but schema has it required.
				// Let's fetch the tab's current sortOrder as a sane default for the user preference
				const currentTab = await db.query.tab.findFirst({
					where: eq(tab.id, tabId)
				});

				await db.insert(userTabPreference).values({
					userId: locals.user.id,
					tabId: tabId,
					isVisible: isVisible,
					sortOrder: currentTab?.sortOrder || 0
				});
			}

			return { success: true };
		} catch (error) {
			console.error('Error toggling visibility:', error);
			return { success: false, message: 'Database error' };
		}
	}
};
