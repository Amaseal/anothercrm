import { eq } from 'drizzle-orm';
import { material, tab, tabGroup } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.tab.findFirst({
		where: eq(tab.id, Number(params.id)),
		with: { translations: true }
	});

	return { item };
};

export const actions: Actions = {
	default: async ({ params }) => {
		try {
			await db.delete(tab).where(eq(tab.id, Number(params.id)));
		} catch (error) {
			return fail(400, { message: m['components.delete_modal.error']({ item: tabGroup.id }) });
		}
		redirect(303, '/projekti/struktura');
	}
};
