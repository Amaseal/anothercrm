import { json } from '@sveltejs/kit';
import { getUserNotifications } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const notifications = await getUserNotifications(locals.user.id);
		return json({ notifications });
	} catch (error) {
		console.error('Error fetching notifications:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
