import { db } from '$lib/server/db';
import { material } from '$lib/server/db/schema';
import { and, desc, asc, sql, count } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { handleListParams } from '$lib/server/paramState';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const activeParams = handleListParams(url, cookies, '/audumi', 'audumi_filters');

	// Parse query parameters
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
			sql`(${material.title} LIKE ${searchTerm} OR ${material.article} LIKE ${searchTerm} OR ${material.manufacturer} LIKE ${searchTerm}) OR ${material.remaining} LIKE ${searchTerm}`
		);
	}

	// Get total count for pagination
	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(material)
		.where(filterConditions.length > 0 ? and(...filterConditions) : sql`1=1`);

	// Create a safe mapping of sortable columns
	const sortableColumns = {
		title: material.title,
		article: material.article,
		manufacturer: material.manufacturer,
		remaining: material.remaining,
		width: material.width
	};

	// Choose the column to sort by
	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: material.id; // Default to id

	// Get paginated data with proper sorting
	const materials = await db.query.material.findMany({
		where: filterConditions.length > 0 ? and(...filterConditions) : undefined,
		orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
		limit: pageSize,
		offset: offset
	});

	return {
		materials,
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
