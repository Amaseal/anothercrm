import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { CHANGELOG } from '$lib/config/changelog';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const userSettings = await db.query.settings.findFirst({
		where: eq(settings.userId, locals.user.id)
	});

	const currentVersion = CHANGELOG[0].version;
	const needsChangelog = userSettings?.lastSeenChangelogVersion !== currentVersion;

	return {
		user: locals.user,
		changelog: needsChangelog ? CHANGELOG : null
	};
};
