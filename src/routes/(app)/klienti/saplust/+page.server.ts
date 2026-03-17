import { db } from '$lib/server/db';
import { client, userClient, task, invoice, clientProductPrice, inviteCodes } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ url }) => {
	const ids = url.searchParams.get('ids');
	if (!ids) return { clients: [], userLinkedClientIds: [] };

	const clientIds = ids
		.split(',')
		.map(Number)
		.filter((n) => !isNaN(n) && n > 0);

	if (clientIds.length < 2) return { clients: [], userLinkedClientIds: [] };

	const clients = await db.query.client.findMany({
		where: inArray(client.id, clientIds)
	});

	// Find which clients have user links
	const userLinks = await db.query.userClient.findMany({
		where: inArray(userClient.clientId, clientIds)
	});

	const userLinkedClientIds = [...new Set(userLinks.map((ul) => ul.clientId))];

	return { clients, userLinkedClientIds };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const primaryIdRaw = formData.get('primaryId') as string;
		const clientIdsRaw = formData.get('clientIds') as string;

		const primaryId = Number(primaryIdRaw);
		const clientIds = clientIdsRaw
			.split(',')
			.map(Number)
			.filter((n) => !isNaN(n) && n > 0);

		// Validate minimum count
		if (clientIds.length < 2) {
			return fail(400, { message: m['clients.errors.merge_min_clients']() });
		}

		// Validate primary is in the selection
		if (!clientIds.includes(primaryId)) {
			return fail(400, { message: m['clients.errors.merge_primary_not_in_selection']() });
		}

		// Check how many selected clients have user links
		const userLinks = await db.query.userClient.findMany({
			where: inArray(userClient.clientId, clientIds)
		});

		const userLinkedClientIds = [...new Set(userLinks.map((ul) => ul.clientId))];

		// If more than one distinct client has user links, abort
		if (userLinkedClientIds.length > 1) {
			return fail(400, { message: m['clients.errors.merge_multiple_user_clients']() });
		}

		// If exactly one has a user link, it MUST be the primary
		if (userLinkedClientIds.length === 1 && userLinkedClientIds[0] !== primaryId) {
			return fail(400, {
				message: m['clients.errors.merge_primary_not_in_selection']()
			});
		}

		const duplicateIds = clientIds.filter((id) => id !== primaryId);

		try {
			await db.transaction(async (tx) => {
				// Re-point tasks
				await tx
					.update(task)
					.set({ clientId: primaryId })
					.where(inArray(task.clientId, duplicateIds));

				// Re-point invoices
				await tx
					.update(invoice)
					.set({ clientId: primaryId })
					.where(inArray(invoice.clientId, duplicateIds));

				// Re-point user_client links (move any user links from duplicates to primary)
				// First check for any that would create duplicates (user already linked to primary)
				const existingPrimaryLinks = await tx.query.userClient.findMany({
					where: eq(userClient.clientId, primaryId)
				});
				const existingPrimaryUserIds = existingPrimaryLinks.map((l) => l.userId);

				const duplicateUserLinks = await tx.query.userClient.findMany({
					where: inArray(userClient.clientId, duplicateIds)
				});

				for (const link of duplicateUserLinks) {
					if (!existingPrimaryUserIds.includes(link.userId)) {
						// Safe to move
						await tx
							.update(userClient)
							.set({ clientId: primaryId })
							.where(eq(userClient.userId, link.userId));
					}
					// If already linked to primary, the old one will be removed by cascade when we delete the duplicate
				}

				// Re-point client product prices (skip if it would violate unique constraint)
				const existingPrimaryPrices = await tx.query.clientProductPrice.findMany({
					where: eq(clientProductPrice.clientId, primaryId)
				});
				const primaryProductIds = existingPrimaryPrices.map((p) => p.productId);

				const duplicatePrices = await tx.query.clientProductPrice.findMany({
					where: inArray(clientProductPrice.clientId, duplicateIds)
				});

				for (const price of duplicatePrices) {
					if (!primaryProductIds.includes(price.productId)) {
						await tx
							.update(clientProductPrice)
							.set({ clientId: primaryId })
							.where(eq(clientProductPrice.id, price.id));
					}
					// If primary already has a price for this product, just leave the duplicate to be cascade-deleted
				}

				// Re-point invite codes
				await tx
					.update(inviteCodes)
					.set({ clientId: primaryId })
					.where(inArray(inviteCodes.clientId, duplicateIds));

				// Delete the duplicate clients (cascades handle userClient, clientProductPrice cleanup)
				await tx.delete(client).where(inArray(client.id, duplicateIds));
			});
		} catch (error) {
			console.error('Merge error:', error);
			return fail(500, { message: m['clients.errors.something_went_wrong']() });
		}

		redirect(303, '/klienti');
	}
};
