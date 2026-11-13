import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { task, settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const sessionUser = locals.user;
	if (!sessionUser) {
		return json({ error: 'Nav autorizēts' }, { status: 401 });
	}

	// Get the integration credentials saved in user settings
	const userSettings = await db.query.settings.findFirst({
		where: eq(settings.userId, sessionUser.id)
	});

	// Check if user has Nextcloud credentials configured
	if (!userSettings?.nextcloud_username || !userSettings.nextcloud_password) {
		return json(
			{
				error: 'Nextcloud iestatījumi nav konfigurēti. Lūdzu, dodieties uz iestatījumiem.'
			},
			{ status: 400 }
		);
	}
	const NEXTCLOUD_URL = userSettings.nextcloud || env.NEXTCLOUD_URL;
	if (!NEXTCLOUD_URL) {
		return json({ error: 'Nextcloud URL nav konfigurēts sistēmā' }, { status: 500 });
	}
	try {
		const { taskId, conversationToken, messageType = 'rich' } = await request.json();
		if (!taskId || !conversationToken) {
			return json({ error: 'Trūkst obligāto parametru' }, { status: 400 });
		}

		// Get the task with its client information
		const taskData = await db.query.task.findFirst({
			where: eq(task.id, taskId),
			with: {
				client: true
			}
		});

		if (!taskData) {
			return json({ error: 'Uzdevums nav atrasts' }, { status: 404 });
		}

		const baseUrl = NEXTCLOUD_URL.replace(/\/$/, ''); // Remove trailing slash
		const origin = url.origin;

		// Create auth header using user's stored credentials
		const auth = Buffer.from(
			`${userSettings.nextcloud_username}:${userSettings.nextcloud_password}`
		).toString('base64');
		const headers = {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'OCS-APIRequest': 'true'
		};
		let response;
		if (messageType === 'rich') {
			// Send formatted text message for the task
			const clientInfo = taskData.client ? ` (${taskData.client.name})` : '';

			const message =
				`📋 **${taskData.title}**${clientInfo}\n\n` +
				`🔗 [Skatīt uzdevumu FastCRM](${origin}/projekti/labot/${taskData.id})`;

			const payload = {
				message: message
			};

			response = await fetch(`${baseUrl}/ocs/v2.php/apps/spreed/api/v1/chat/${conversationToken}`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams(payload)
			});
		} else {
			// Send as plain text message
			const clientInfo = taskData.client ? ` (${taskData.client.name})` : '';
			const message = `📋 ${taskData.title}${clientInfo}\n\n Skatīt FastCRM: ${origin}/projekti/labot/${taskData.id}`;

			const payload = {
				message: message
			};

			response = await fetch(`${baseUrl}/ocs/v2.php/apps/spreed/api/v1/chat/${conversationToken}`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams(payload)
			});
		}
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Nextcloud Talk API error:', errorText);

			let errorMessage = 'Neizdevās nosūtīt uz Nextcloud Talk';

			// Try to parse the error for more specific messages
			try {
				const errorData = JSON.parse(errorText);
				if (errorData.ocs?.meta?.message) {
					errorMessage = errorData.ocs.meta.message;
				} else if (errorData.ocs?.meta?.statuscode === 404) {
					errorMessage = 'Saruna nav atrasta vai nav pieejama';
				} else if (errorData.ocs?.meta?.statuscode === 403) {
					errorMessage = 'Nav tiesību rakstīt šajā sarunā';
				} else if (errorData.ocs?.meta?.statuscode === 400) {
					errorMessage = 'Nepareizi dati vai saruna vairs nav aktīva';
				}
			} catch (e) {
				// If error parsing fails, use default message
			}

			return json(
				{
					error: errorMessage
				},
				{ status: response.status }
			);
		}
		const result = await response.json();
		return json({
			success: true,
			message: 'Uzdevums veiksmīgi nosūtīts uz Nextcloud Talk',
			data: result
		});
	} catch (error) {
		console.error('Error sharing to Nextcloud Talk:', error);
		return json(
			{
				error: 'Neizdevās nosūtīt uzdevumu',
				details: error instanceof Error ? error.message : 'Nezināma kļūda'
			},
			{ status: 500 }
		);
	}
};
