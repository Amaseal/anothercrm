import { db } from '$lib/server/db';
import { client } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';
import { and, desc, asc, sql, count } from 'drizzle-orm';
import { handleListParams } from '$lib/server/paramState';

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
			sql`(${client.name} LIKE ${searchTerm} OR ${client.type} LIKE ${searchTerm})`
		);
	}

	// Get total count for pagination
	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(client)
		.where(filterConditions.length > 0 ? and(...filterConditions) : sql`1=1`);

	// Create a safe mapping of sortable columns
	const sortableColumns = {
		name: client.name,
		type: client.type,
		totalOrdered: client.totalOrdered
	};

	// Choose the column to sort by
	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: client.id; // Default to id

	// Get paginated data with proper sorting
	const clients = await db.query.client.findMany({
		where: filterConditions.length > 0 ? and(...filterConditions) : undefined,
		orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
		limit: pageSize,
		offset: offset
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
