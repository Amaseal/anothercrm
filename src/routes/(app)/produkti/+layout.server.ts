import { db } from '$lib/server/db';

import { product } from '$lib/server/db/schema';
import { and, desc, asc, sql, count } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '0');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
	const search = url.searchParams.get('search') || '';
	const sortColumn = url.searchParams.get('sortColumn') || 'id';
	const sortDirection = url.searchParams.get('sortDirection') || 'asc';

	// Calculate offset for pagination
	const offset = page * pageSize;

	// Build the filter conditions
	let filterConditions = [];

	if (search) {
		const searchTerm = `%${search}%`;
		filterConditions.push(
			sql`(${product.title} LIKE ${searchTerm} OR ${product.description} LIKE ${searchTerm})`
		);
	}

	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(product)
		.where(filterConditions.length > 0 ? and(...filterConditions) : sql`1=1`);

	const sortableColumns = {
		title: product.title,
		cost: product.cost
	};

	const columnToSort =
		sortColumn in sortableColumns
			? sortableColumns[sortColumn as keyof typeof sortableColumns]
			: product.id; // Default to id

	const productData = await db.query.product.findMany({
		where: filterConditions.length > 0 ? and(...filterConditions) : undefined,
		orderBy: sortDirection === 'asc' ? asc(columnToSort) : desc(columnToSort),
		limit: pageSize,
		offset: offset
	});

	let products = productData.map((product) => {
		return {
			id: product.id,
			title: product.title,
			description: product.description,
			cost: (product.cost / 100).toFixed(2),
			created_at: product.created_at,
			updated_at: product.updated_at
		};
	});

	return {
		products,
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
