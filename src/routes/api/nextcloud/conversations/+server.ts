import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ locals }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return json({ error: 'Nav autorizēts' }, { status: 401 });
	}

	// Get full user data from database
	const fullUser = await db.query.user.findFirst({
		where: eq(user.id, sessionUser.id)
	});

	if (!fullUser) {
		return json({ error: 'Lietotājs nav atrasts' }, { status: 404 });
	}

	// Check if user has Nextcloud credentials configured
	if (!fullUser.nextcloud_username || !fullUser.nextcloud_password) {
		return json(
			{
				error: 'Nextcloud iestatījumi nav konfigurēti. Lūdzu, dodieties uz iestatījumiem.'
			},
			{ status: 400 }
		);
	}

	const NEXTCLOUD_URL = env.NEXTCLOUD_URL;
	if (!NEXTCLOUD_URL) {
		return json({ error: 'Nextcloud URL nav konfigurēts sistēmā' }, { status: 500 });
	}

	try {
		const baseUrl = NEXTCLOUD_URL.replace(/\/$/, ''); // Remove trailing slash

		// Create auth header using user's stored credentials
		const auth = Buffer.from(
			`${fullUser.nextcloud_username}:${fullUser.nextcloud_password}`
		).toString('base64');
		const headers = {
			Authorization: `Basic ${auth}`,
			Accept: 'application/json',
			'OCS-APIRequest': 'true'
		};

		// Get list of conversations
		const response = await fetch(`${baseUrl}/ocs/v2.php/apps/spreed/api/v4/room`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Nextcloud Talk API error:', errorText);
			return json(
				{
					error: 'Failed to fetch conversations',
					details: errorText
				},
				{ status: response.status }
			);
		}

		const result = await response.json();

		// Extract conversations from the OCS response
		const conversations = result.ocs?.data || [];

		// Format conversations for the frontend
		const formattedConversations = conversations.map((conv: any) => ({
			token: conv.token,
			name: conv.displayName || conv.name,
			description: conv.description || '',
			type: conv.type, // 1=one-to-one, 2=group, 3=public, 4=changelog
			participantCount: conv.participantCount || 0,
			hasPassword: !!conv.hasPassword,
			canStartCall: conv.canStartCall,
			avatarUrl: conv.avatar ? `${baseUrl}${conv.avatar}` : null
		}));

		return json({
			success: true,
			conversations: formattedConversations
		});
	} catch (error) {
		console.error('Error fetching Nextcloud Talk conversations:', error);
		return json(
			{
				error: 'Neizdevās ielādēt sarunas',
				details: error instanceof Error ? error.message : 'Nezināma kļūda'
			},
			{ status: 500 }
		);
	}
};
