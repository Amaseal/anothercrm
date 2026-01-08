import { redirect } from '@sveltejs/kit';
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
		where: eq(passwordResetToken.token, token as string)
	});

	if (!dbToken || dbToken.used || dbToken.expiresAt < new Date()) {
		return fail(400, { message: m['reset.errors.invalid_or_expired_token']() });
	}

	const existingUser = await db.query.user.findFirst({
		where: eq(user.id, dbToken.userId)
	});

	if (!existingUser) {
		return fail(404, { message: m['reset.errors.user_not_found']() });
	}

	return { user: existingUser };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password');
		const userId = formData.get('user_id');

		if (password !== confirmPassword) {
			return fail(400, { message: m['reset.errors.passwords_must_match']() });
		}
		const dbUser = await db.query.user.findFirst({
			where: eq(user.id, userId as string)
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
				.where(eq(user.id, userId as string));
		} catch (error) {
			return fail(500, { message: 'Error updating password' });
		}

		redirect(302, '/login');
	}
};
