import { db } from '$lib/server/db';
import { client, task, invoice, taskProduct, product } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';
import { and, desc, asc, sql, count, or, eq, inArray } from 'drizzle-orm';
import { handleListParams } from '$lib/server/paramState';
import { ilikeNormalize } from '$lib/server/dbUtils';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const activeParams = handleListParams(url, cookies, '/klienti', 'klienti_filters');

	const page = parseInt(activeParams.get('page') || '0');
	const pageSize = parseInt(activeParams.get('pageSize') || '50');
	const search = activeParams.get('search') || '';
	const sortColumn = activeParams.get('sortColumn') || 'id';
	const sortDirection = activeParams.get('sortDirection') || 'asc';

	// Calculate offset for pagination
	const offset = page * pageSize;

	// Build the filter conditions
	let filterConditions = [];

	if (search) {
		const searchTerm = `%${search}%`;
		filterConditions.push(
			or(
				ilikeNormalize(client.name, search),
				sql`${client.type}::text ILIKE ${searchTerm}`
			)
		);
	}

	// Get total count for pagination
	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(client)
		.where(filterConditions.length > 0 ? and(...filterConditions) : sql`1=1`);
	// Live revenue expression (matches dashboard formula)
	const liveRevenue = sql<number>`
		COALESCE(SUM(DISTINCT CASE WHEN ${invoice.id} IS NOT NULL THEN ${invoice.subtotal} ELSE ${task.price} END), 0)
	`;

	// Create a safe mapping of sortable columns
	const sortableColumns = {
		name: client.name,
		type: client.type
	};

	// Choose the column to sort by — totalOrdered uses live revenue instead of the stale DB column
	const isSortByRevenue = sortColumn === 'totalOrdered';
	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: client.id; // Default to id

	// Single query: join tasks + invoices to get live revenue and sort/paginate in one go
	const clientRows = await db
		.select({
			id: client.id,
			totalRevenue: liveRevenue
		})
		.from(client)
		.leftJoin(task, eq(task.clientId, client.id))
		.leftJoin(invoice, eq(invoice.clientId, client.id))
		.where(filterConditions.length > 0 ? and(...filterConditions) : undefined)
		.groupBy(client.id)
		.orderBy(
			isSortByRevenue
				? (sortDirection === 'asc' ? asc(liveRevenue) : desc(liveRevenue))
				: (sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort))
		)
		.limit(pageSize)
		.offset(offset);

	const clientIds = clientRows.map((r) => r.id);
	const revenueMap = new Map(clientRows.map((r) => [r.id, Number(r.totalRevenue)]));

	// Fetch full client records for this page
	const clientRecords = clientIds.length > 0
		? await db.query.client.findMany({ where: inArray(client.id, clientIds) })
		: [];

	// Merge live revenue into client records, preserving sort order
	const clients = clientRows.map((row) => {
		const rec = clientRecords.find((c) => c.id === row.id)!;
		return { ...rec, totalOrdered: revenueMap.get(row.id) ?? 0 };
	});

	return {
		clients,
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
