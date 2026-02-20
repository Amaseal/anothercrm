
import { db } from '$lib/server/db';
import { invoice, client, task, userClient } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';
import { and, desc, asc, sql, count, like, or, eq, inArray } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { handleListParams } from '$lib/server/paramState';

export const load: LayoutServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const activeParams = handleListParams(url, cookies, '/rekini', 'rekini_filters');

	const page = parseInt(activeParams.get('page') || '0');
	const pageSize = parseInt(activeParams.get('pageSize') || '50');
	const search = activeParams.get('search') || '';
	const sortColumn = activeParams.get('sortColumn') || 'issueDate';
	const sortDirection = activeParams.get('sortDirection') || 'desc';

	// Calculate offset for pagination
	const offset = page * pageSize;

	// Build the filter conditions
	// We'll collect conditions for the WHERE clause
	let baseConditions = [];

	// Client-specific filtering
	if (locals.user.type === 'client') {
		// Get client IDs associated with this user
		const userClients = await db.query.userClient.findMany({
			where: eq(userClient.userId, locals.user.id),
			columns: { clientId: true }
		});
		const associatedClientIds = userClients.map((uc) => uc.clientId);

		if (associatedClientIds.length > 0) {
			baseConditions.push(inArray(invoice.clientId, associatedClientIds));
		} else {
			// If client has no associated clients, they shouldn't see any invoices
			baseConditions.push(sql`1 = 0`);
		}
	}

	// Search implementation (find matching IDs first to handle joins properly)
	if (search) {
		const searchTerm = `%${search}%`;
		// Find IDs that match the search term (invoice number or client name)
		const searchMatches = await db
			.select({ id: invoice.id })
			.from(invoice)
			.leftJoin(client, eq(invoice.clientId, client.id))
			.where(
				or(
					like(invoice.invoiceNumber, searchTerm),
					like(client.name, searchTerm)
				)
			);

		if (searchMatches.length > 0) {
			const matchedIds = searchMatches.map((m) => m.id);
			baseConditions.push(inArray(invoice.id, matchedIds));
		} else {
			baseConditions.push(sql`1 = 0`); // No search results
		}
	}

	const whereCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined;

	// Get total count for pagination
	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(invoice)
		.where(whereCondition);

	// Create a safe mapping of sortable columns
	const sortableColumns = {
		invoiceNumber: invoice.invoiceNumber,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		total: invoice.total,
		status: invoice.status,
		// clientName: client.name // Sorting by joined column in db.query is elusive, stick to invoice main cols or use sort on ID from subquery
	};

	// Choose the column to sort by
	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: invoice.issueDate; // Default to issueDate

	// Get paginated data
	const invoicesResult = await db.query.invoice.findMany({
		with: {
			client: true,
			task: true
		},
		where: whereCondition,
		orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
		limit: pageSize,
		offset: offset
	});

	return {
		invoices: invoicesResult,
		pagination: {
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize),
			search,
			sortColumn,
			sortDirection
		}
	};
};
