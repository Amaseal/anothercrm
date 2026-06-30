import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { CHANGELOG } from '$lib/config/changelog';

const CHANGELOG_COOKIE = 'changelog_seen';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const currentVersion = CHANGELOG[0].version;

	// Fast path: cookie already records the seen version — no DB query needed
	if (cookies.get(CHANGELOG_COOKIE) === currentVersion) {
		return { user: locals.user, changelog: null };
	}

	// Slow path: check DB (first load on this device, or new changelog version)
	const userSettings = await db.query.settings.findFirst({
		where: eq(settings.userId, locals.user.id)
	});

	const seen = userSettings?.lastSeenChangelogVersion === currentVersion;

	if (seen) {
		// Sync the cookie so future loads skip the DB
		cookies.set(CHANGELOG_COOKIE, currentVersion, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false });
		return { user: locals.user, changelog: null };
	}

	return { user: locals.user, changelog: CHANGELOG };
};
