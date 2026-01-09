import type { LayoutServerLoad } from '../$types';
import { db } from '$lib/server/db';
import { userTabPreference, tab } from '@/server/db/schema';
import { eq, or, isNull } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
	const user = locals.user;

	// Fetch user preferences if user is logged in
	const preferences = user
		? await db.query.userTabPreference.findMany({
			where: eq(userTabPreference.userId, user.id)
		})
		: [];

	// Helper to check if tab is visible
	const isTabVisible = (tabId: number) => {
		const pref = preferences.find((p) => p.tabId === tabId);
		return pref ? pref.isVisible : true; // Default to true
	};

	// Admin users: fetch tabs with translations and tasks
	if (user?.type === 'admin') {
		const rawTabs = await db.query.tab.findMany({
			where: or(isNull(tab.userId), eq(tab.userId, user.id)),
			with: {
				translations: true,
				tasks: true,
				group: {
					with: {
						translations: true
					}
				}
			},
			orderBy: (tab, { asc }) => [asc(tab.sortOrder)]
		});

		// Filter hidden tabs
		const tabs = rawTabs.filter((tab) => isTabVisible(tab.id));

		return {
			user,
			tabs
		};
	}

	if (!user) {
		return {
			user: null,
			tabGroups: []
		};
	}

	// Non-admin users: fetch tabGroups with all tasks from tabs in those groups
	const tabGroups = await db.query.tabGroup.findMany({
		with: {
			translations: true,
			tabs: {
				where: (tabs, { or, eq, isNull }) => or(isNull(tabs.userId), eq(tabs.userId, user.id)),
				with: {
					tasks: true
				}
			}
		},
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)]
	});

	// Transform data to flatten tasks from all tabs into the group level
	// And filter out hidden tabs
	const tabGroupsWithTasks = tabGroups
		.map((group) => {
			// Filter tabs within the group first
			const visibleTabs = group.tabs.filter((tab) => isTabVisible(tab.id));

			if (visibleTabs.length === 0) return null; // or keep empty group? Let's keep empty group if it has logic, but here we just want tasks

			return {
				...group,
				tasks: visibleTabs.flatMap((tab) => tab.tasks),
				tabs: undefined // Remove tabs from the response since non-admins don't need tab structure
			};
		})
		.filter((group) => group !== null);

	return {
		user,
		tabGroups: tabGroupsWithTasks
	};
};
