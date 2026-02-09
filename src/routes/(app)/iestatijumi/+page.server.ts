
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { hash } from '@node-rs/argon2';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const user = locals.user;

	// Fetch user settings
	const userSettings = await db.query.settings.findFirst({
		where: eq(table.settings.userId, user.id)
	});

	let clients: { id: number; email: string | null; name: string; type: "BTC" | "BTB"; registrationNumber: string | null; vatNumber: string | null; address: string | null; bankName: string | null; bankCode: string | null; bankAccount: string | null; phone: string | null; created_at: Date; updated_at: Date; description: string | null; vatRate: number; totalOrdered: number | null; }[] = [];
	let linkedClient = null;

	if (user.type === 'admin') {
		// Admin needs list of clients for invite generation
		clients = await db.query.client.findMany();
	} else {
		// Client needs their linked client details
		const userClientLink = await db.query.userClient.findFirst({
			where: eq(table.userClient.userId, user.id),
			with: {
				client: true
			}
		});
		if (userClientLink) {
			linkedClient = userClientLink.client;
		}
	}

	return {
		user,
		userSettings,
		clients,
		linkedClient
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirm_password') as string;

		if (password) {
			if (password !== confirmPassword) {
				return fail(400, { message: m['settings.passwords_do_not_match']() });
			}

			const passwordHash = await hash(password, {
				memoryCost: 19456,
				timeCost: 2,
				outputLen: 32,
				parallelism: 1
			});
			await db.update(table.user)
				.set({ password: passwordHash })
				.where(eq(table.user.id, locals.user.id));
		}
		return { success: true };
	},
	updateSettings: async ({ request, locals }) => {
		if (!locals.user || locals.user.type !== 'admin') return fail(403);
		const data = await request.formData();
		const nextcloud = data.get('nextcloud') as string;
		const nextcloud_username = data.get('nextcloud_username') as string;
		// Ideally we only update password if provided, but concise logic for now
		const nextcloud_password = data.get('nextcloud_password') as string;

		// Check if settings exist
		const existing = await db.query.settings.findFirst({
			where: eq(table.settings.userId, locals.user.id)
		});

		const settingsData: any = {
			nextcloud,
			nextcloud_username
		};
		if (nextcloud_password) {
			settingsData.nextcloud_password = nextcloud_password;
		}

		if (existing) {
			await db.update(table.settings)
				.set(settingsData)
				.where(eq(table.settings.userId, locals.user.id));
		} else {
			await db.insert(table.settings).values({
				id: crypto.randomUUID(),
				userId: locals.user.id,
				language: 'lv',
				...settingsData
			});
		}
		return { success: true };
	},
	generateInvite: async ({ request, locals }) => {
		if (!locals.user || locals.user.type !== 'admin') return fail(403);
		const data = await request.formData();
		const role = data.get('role') as 'admin' | 'client';
		const clientId = data.get('clientId') ? parseInt(data.get('clientId') as string) : null;

		if (role === 'client' && !clientId) {
			return fail(400, { message: 'Client must be selected for client invites.' });
		}

		// Generate Code
		const code = Math.random().toString(36).substring(2, 10).toUpperCase();

		await db.insert(table.inviteCodes).values({
			id: crypto.randomUUID(),
			code,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days
			codeFor: role,
			clientId: role === 'client' ? clientId : null
		});

		return { success: true, code };
	},
	updateClientInfo: async ({ request, locals }) => {
		if (!locals.user || locals.user.type !== 'client') return fail(403);
		const data = await request.formData();

		// Find linked client
		const userClientLink = await db.query.userClient.findFirst({
			where: eq(table.userClient.userId, locals.user.id),
		});

		if (userClientLink) {
			await db.update(table.client)
				.set({
					name: data.get('name') as string,
					email: data.get('email') as string,
					phone: data.get('phone') as string,
					address: data.get('address') as string,
					vatNumber: data.get('vatNumber') as string,
					registrationNumber: data.get('registrationNumber') as string,
					bankName: data.get('bankName') as string,
					bankCode: data.get('bankCode') as string,
					bankAccount: data.get('bankAccount') as string,
					description: data.get('description') as string
				})
				.where(eq(table.client.id, userClientLink.clientId));
		} else {
			return fail(400, { message: 'No client linked to this user.' });
		}
		return { success: true };
	}
};
