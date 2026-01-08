import { json } from '@sveltejs/kit';
import { markNotificationAsRead, markNotificationsAsRead } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { notificationId, markAllAsRead } = await request.json();

		if (markAllAsRead) {
			// Mark all notifications as read for the user
			await markNotificationsAsRead(locals.user.id);
		} else if (notificationId) {
			// Mark specific notification as read
			await markNotificationAsRead(notificationId, locals.user.id);
		} else {
			return json({ error: 'Either notificationId or markAllAsRead must be provided' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error marking notifications as read:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
