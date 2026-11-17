import { db } from '$lib/server/db';
import { product } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getClientScope } from '$lib/server/task-access';

export const load: PageServerLoad = async ({ params, locals }) => {
	await getClientScope(locals);
	const item = await db.query.product.findFirst({
		where: eq(product.id, Number(params.id)),
		with: {
			translations: true
		}
	});

	if (!item) {
		throw redirect(303, '/produkti');
	}

	return { item };
};
