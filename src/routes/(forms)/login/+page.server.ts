import { fail, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import * as table from '$lib/server/db/schema';
import { verify } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import * as auth from '$lib/server/auth';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
};

export const actions = {
	default: async (event) => {
		const { cookies } = event;
		let form = await event.request.formData();

		const email = form.get('email') as string;
		const password = form.get('password') as string;

		const results = await db.select().from(table.user).where(eq(table.user.email, email));

		const existingUser = results.at(0);
		if (!existingUser) {
			return fail(400, { message: m['login.errors.invalid_credentials']() });
		}

		const validPassword = await verify(existingUser.password, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		if (!validPassword) {
			return fail(400, { message: m['login.errors.invalid_credentials']() });
		}

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, existingUser.id);
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return redirect(302, '/');
	}
} satisfies Actions;
