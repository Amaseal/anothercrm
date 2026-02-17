import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hash } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';
import { locales } from '@/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userCount = await db.select().from(table.user).limit(1);

	if (userCount.length === 0) {
		// No users exist, allow registration without invite code
		return;
	}
	const inviteCode = url.searchParams.get('code');

	if (!inviteCode) {
		throw redirect(302, '/forbidden');
	}

	// Validate the invite code
	const validInviteCode = await db
		.select()
		.from(table.inviteCodes)
		.where(and(eq(table.inviteCodes.code, inviteCode), eq(table.inviteCodes.used, false)))
		.limit(1);

	if (validInviteCode.length === 0) {
		throw redirect(302, '/forbidden');
	}

	// Check if the code has expired
	const now = new Date();
	const expiresAt = new Date(validInviteCode[0].expiresAt);

	if (now > expiresAt) {
		throw redirect(302, '/forbidden');
	}
};

export const actions = {
	default: async (event) => {
		const inviteCode = event.url.searchParams.get('code') as string;
		const userCount = await db.select().from(table.user).limit(1);

		const validInviteCode = await db
			.select()
			.from(table.inviteCodes)
			.where(and(eq(table.inviteCodes.code, inviteCode), eq(table.inviteCodes.used, false)))
			.limit(1);

		if (userCount.length > 0) {
			if (!inviteCode) {
				return fail(400, { message: m['register.errors.invalid_invite_code']() });
			}

			if (validInviteCode.length === 0) {
				return fail(400, { message: m['register.errors.invalid_invite_code']() });
			}
			const now = new Date();
			const expiresAt = new Date(validInviteCode[0].expiresAt);
			if (now > expiresAt) {
				return fail(400, { message: m['register.errors.invite_code_expired']() });
			}
		}

		let form = await event.request.formData();

		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const passwordConfirm = form.get('password_confirmation') as string;
		const name = form.get('name') as string;
		if (!email || !password || !passwordConfirm || !name) {
			return fail(400, { message: m['register.errors.required_fields']() });
		}
		if (password !== passwordConfirm) {
			return fail(400, { message: m['register.errors.passwords_must_match']() });
		}

		const userId = generateUserId();
		const passwordHash = await hash(password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		try {
			await db.insert(table.user).values({ id: userId, email, password: passwordHash, name: name }); // Mark the invite code as used

			// If the invite code has a clientId, link the user to that client
			if (validInviteCode[0].clientId) {
				await db.insert(table.userClient).values({
					userId: userId,
					clientId: validInviteCode[0].clientId
				});
			}

			if (userCount.length > 0) {
				await db
					.update(table.inviteCodes)
					.set({
						used: true
					})
					.where(eq(table.inviteCodes.id, validInviteCode[0].id));
			}
			const sessionToken = auth.generateSessionToken();
			const session = await auth.createSession(sessionToken, userId);
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
		} catch (e) {
			return fail(500, { message: m['register.errors.something_went_wrong']() });
		}
		return redirect(302, '/');
	}
} satisfies Actions;

function generateUserId() {
	// ID with 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}
