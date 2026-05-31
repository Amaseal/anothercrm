import { redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm/sql/expressions/conditions';
import { passwordResetToken, user } from '$lib/server/db/schema';
import { hash } from '@node-rs/argon2';
import { fail } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return redirect(302, '/login');
	}

	const dbToken = await db.query.passwordResetToken.findFirst({
		where: eq(passwordResetToken.token, token)
	});

	if (!dbToken || dbToken.used || dbToken.expiresAt < new Date()) {
		error(400, m['reset.errors.invalid_or_expired_token']());
	}

	const existingUser = await db.query.user.findFirst({
		where: eq(user.id, dbToken.userId)
	});

	if (!existingUser) {
		error(404, m['reset.errors.user_not_found']());
	}

	// Pass the token (not the user id) to the form so the action can re-validate it
	return { token };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password');
		const token = formData.get('token') as string;

		if (password !== confirmPassword) {
			return fail(400, { message: m['reset.errors.passwords_must_match']() });
		}

		// Re-validate the token server-side — never trust a client-supplied user_id
		const dbToken = await db.query.passwordResetToken.findFirst({
			where: eq(passwordResetToken.token, token)
		});

		if (!dbToken || dbToken.used || dbToken.expiresAt < new Date()) {
			return fail(400, { message: m['reset.errors.invalid_or_expired_token']() });
		}

		const dbUser = await db.query.user.findFirst({
			where: eq(user.id, dbToken.userId)
		});
		if (!dbUser) {
			return fail(404, { message: m['reset.errors.user_not_found']() });
		}

		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		try {
			await db
				.update(user)
				.set({ password: passwordHash })
				.where(eq(user.id, dbToken.userId));
			// Mark the token as used so the reset link cannot be reused
			await db
				.update(passwordResetToken)
				.set({ used: true })
				.where(eq(passwordResetToken.token, token));
		} catch (err) {
			return fail(500, { message: 'Error updating password' });
		}

		redirect(302, '/login');
	}
};
