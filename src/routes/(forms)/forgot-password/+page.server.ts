import { fail, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import * as table from '$lib/server/db/schema';
import { sendPasswordResetEmail } from '$lib/server/mailUtils';
import { db } from '$lib/server/db';
import * as auth from '$lib/server/auth';
import * as m from '$lib/paraglide/messages';
import { user } from '$lib/server/db/schema';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
};

export const actions = {
	default: async (event) => {
		let form = await event.request.formData();

		const email = form.get('email') as string;

		const existingUser = await db.query.user.findFirst({
			where: eq(user.email, email)
		});
		if (!existingUser) {
			return redirect(302, '/login?reset=sent');
		}

		const token = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

		try {
			await db
				.update(table.passwordResetToken)
				.set({ used: true })
				.where(
					and(
						eq(table.passwordResetToken.userId, existingUser.id),
						eq(table.passwordResetToken.used, false)
					)
				);
			await db.insert(table.passwordResetToken).values({
				id: crypto.randomUUID(),
				userId: existingUser.id,
				token,
				expiresAt
			});
			await sendPasswordResetEmail(
				existingUser.email,
				`${event.url.origin}/reset-password?token=${token}`
			);
		} catch (error) {
			return fail(500, { message: m['reset.errors.something_went_wrong']() });
		}

		return redirect(302, '/login?restet=sent');
	}
} satisfies Actions;
