import { db } from '$lib/server/db';
import { product, productTranslation, clientProductPrice, client, user } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import * as m from '$lib/paraglide/messages';
import { locales } from '@/paraglide/runtime';
import { eq } from 'drizzle-orm';

export const load = async () => {
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

	return {
		btbClients
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
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

		// Validation: ensure all client prices have a selected client
		const validClientPrices = clientPrices.filter((cp) => cp.clientId !== null);

		// Default base product title/description to the first locale (or placeholder if empty)
		const fallbackTitle = (form.get(`title-${locales[0]}`) as string) || 'Untitled';
		const fallbackDescription = form.get(`description-${locales[0]}`) as string;

		try {
			await db.transaction(async (tx) => {
				// 1. Insert Base Product
				const [newProduct] = await tx
					.insert(product)
					.values({
						title: fallbackTitle,
						description: fallbackDescription,
						cost: Number(cost),
						price: Number(price) || 0
					})
					.returning({ id: product.id });

				// 2. Insert Translations
				const translationInserts = locales
					.map((locale) => {
						const titleLocale = form.get(`title-${locale}`) as string;
						const descriptionLocale = form.get(`description-${locale}`) as string;

						if (titleLocale) {
							return {
								productId: newProduct.id,
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

				// 3. Insert Client Specific Prices
				if (validClientPrices.length > 0) {
					const clientPriceInserts = validClientPrices.map((cp) => ({
						productId: newProduct.id,
						clientId: Number(cp.clientId),
						price: Number(cp.price) || 0
					}));
					await tx.insert(clientProductPrice).values(clientPriceInserts);
				}
			});
		} catch (error) {
			return fail(500, { message: m['products.errors.creation_failed']() });
		}

		redirect(303, '/produkti');
	}
};
