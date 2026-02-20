import { db } from '$lib/server/db';
import { fail, redirect } from '@sveltejs/kit';

import { product, client, productTranslation, clientProductPrice, user } from '$lib/server/db/schema';

import { eq } from 'drizzle-orm';
import type { Product } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import { m } from '@/paraglide/messages';
import { locales } from '@/paraglide/runtime';

export const load: PageServerLoad = async ({ params }) => {
	const item = await db.query.product.findFirst({
		where: eq(product.id, Number(params.id)),
		with: {
			translations: true,
			clientPrices: true
		}
	});

	// Load all users of type client and their associated client records
	const usersDb = await db.query.user.findMany({
		where: eq(user.type, 'client'),
		with: {
			userClients: {
				with: {
					client: true
				}
			}
		}
	});

	// Each user can have one or more userClients. Flatten the array.
	const btbClients = usersDb.flatMap((u) =>
		u.userClients.map(uc => ({
			id: uc.clientId,
			name: `${u.name} (${uc.client?.name || 'Unknown Company'})`
		}))
	);

	if (!item) {
		throw redirect(303, '/produkti');
	}

	return { item, btbClients };
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		const cost = form.get('cost');
		const price = form.get('price');
		const clientPricesJson = form.get('clientPrices') as string;

		let clientPrices: { clientId: string | null; price: number }[] = [];
		if (clientPricesJson) {
			try {
				clientPrices = JSON.parse(clientPricesJson);
			} catch (e) {
				console.error('Failed to parse client prices', e);
			}
		}

		const validClientPrices = clientPrices.filter((cp) => cp.clientId !== null);

		const fallbackTitle = (form.get(`title-${locales[0]}`) as string) || 'Untitled';
		const fallbackDescription = form.get(`description-${locales[0]}`) as string;

		try {
			await db.transaction(async (tx) => {
				// 1. Update Base Product
				await tx
					.update(product)
					.set({
						title: fallbackTitle,
						description: fallbackDescription,
						cost: Number(cost),
						price: Number(price) || 0
					})
					.where(eq(product.id, Number(params.id)));

				// 2. Update Translations
				// Simple approach: delete all existing and re-insert
				await tx.delete(productTranslation).where(eq(productTranslation.productId, Number(params.id)));

				const translationInserts = locales
					.map((locale) => {
						const titleLocale = form.get(`title-${locale}`) as string;
						const descriptionLocale = form.get(`description-${locale}`) as string;

						if (titleLocale) {
							return {
								productId: Number(params.id),
								language: locale,
								title: titleLocale,
								description: descriptionLocale
							};
						}
						return null;
					})
					.filter((t) => t !== null) as {
						productId: number;
						language: string;
						title: string;
						description: string;
					}[];

				if (translationInserts.length > 0) {
					await tx.insert(productTranslation).values(translationInserts);
				}

				// 3. Update Client Specific Prices
				await tx.delete(clientProductPrice).where(eq(clientProductPrice.productId, Number(params.id)));

				if (validClientPrices.length > 0) {
					const clientPriceInserts = validClientPrices.map((cp) => ({
						productId: Number(params.id),
						clientId: Number(cp.clientId),
						price: Number(cp.price) || 0
					}));
					await tx.insert(clientProductPrice).values(clientPriceInserts);
				}
			});
		} catch (error) {
			return fail(500, { message: m['products.errors.update_failed']() });
		}

		redirect(303, '/produkti');
	}
};
