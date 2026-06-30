import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { CHANGELOG } from '$lib/config/changelog';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });

	const version = CHANGELOG[0].version;

	const existing = await db.query.settings.findFirst({
		where: eq(settings.userId, locals.user.id)
	});

	if (existing) {
		await db
			.update(settings)
			.set({ lastSeenChangelogVersion: version })
			.where(eq(settings.userId, locals.user.id));
	} else {
		const locale = cookies.get('PARAGLIDE_LOCALE');
		const language = locale === 'en' || locale === 'lv' ? locale : 'lv';
		await db.insert(settings).values({
			id: crypto.randomUUID(),
			userId: locals.user.id,
			language,
			lastSeenChangelogVersion: version
		});
	}

	return json({ ok: true });
};
