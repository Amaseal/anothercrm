import type { LayoutServerLoad } from '../$types';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
	const user = locals.user;

	// Admin users: fetch tabs with translations and tasks
	if (user?.type === 'admin') {
		const tabs = await db.query.tab.findMany({
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

		return {
			user,
			tabs
		};
	}

	// Non-admin users: fetch tabGroups with all tasks from tabs in those groups
	const tabGroups = await db.query.tabGroup.findMany({
		with: {
			translations: true,
			tabs: {
				with: {
					tasks: true
				}
			}
		},
		orderBy: (tabGroup, { asc }) => [asc(tabGroup.sortOrder)]
	});

	// Transform data to flatten tasks from all tabs into the group level
	const tabGroupsWithTasks = tabGroups.map((group) => ({
		...group,
		tasks: group.tabs.flatMap((tab) => tab.tasks),
		tabs: undefined // Remove tabs from the response since non-admins don't need tab structure
	}));

	return {
		user,
		tabGroups: tabGroupsWithTasks
	};
};
