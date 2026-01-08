import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';
import { like, asc, sql } from 'drizzle-orm';
import { client } from '$lib/server/db/schema';
import { normalizeLatvianText } from '$lib/utils';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';

	// Only search if query is at least 1 character
	if (query.length === 0) {
		return json([]);
	}

	try {
		// Normalize the search query
		const normalizedQuery = normalizeLatvianText(query).toLowerCase();
		
		// Get all clients and filter in JavaScript for better diacritic handling
		const allClients = await db
			.select()
			.from(client)
			.orderBy(asc(client.name));

		// Filter clients using normalized text comparison
		const filteredClients = allClients
			.filter(c => {
				const normalizedName = normalizeLatvianText(c.name).toLowerCase();
				return normalizedName.includes(normalizedQuery);
			})
			.slice(0, 20); // Limit to 20 results

		return json(filteredClients);
	} catch (error) {
		console.error('Error searching clients:', error);
		return json([], { status: 500 });
	}
};
